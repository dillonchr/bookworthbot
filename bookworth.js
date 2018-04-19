const bookmancy = require('bookmancy');
const etsy = require('./etsy');
const findYear = input => {
    const matches = input.match(/\d{4}/g);
    return matches && matches.length && matches.sort().reverse().find(n => n <= (new Date().getFullYear()));
};

const fixedYears = abeResults => abeResults
    .map(listing => {
        const interpretedYear = findYear(listing.about);
        if (interpretedYear && interpretedYear > listing.year) {
            return {...listing, year: interpretedYear};
        }
        return listing;
    })
    .filter(l => !!l.year);

const allPricesByYears = listings => fixedYears(listings)
    .reduce((years, book) => {
        if (!years[book.year]) {
            years[book.year] = [];
        }
        years[book.year].push(book.price);
        return years;
    }, {});

const averagePrices = prices => prices.reduce((s, c) => s + parseFloat(c), 0) / prices.length;
const listingHasYearOrPub = (listing, years, publisher) => years.some(y => listing.about.includes(y)) || listing.about.toLowerCase().includes(publisher.toLowerCase());


module.exports = searchQuery => {
    const query = searchQuery.title + ' ' + searchQuery.author;

    return Promise.all([
        bookmancy.abe.search(searchQuery),
        Promise.all([
            bookmancy.ebay.searchLiveListings(query).catch(() => []),
            bookmancy.ebay.searchSoldListings(query).catch(() => [])
        ]).then(r => r.reduce((s, c) => s.concat(c), [])),
        etsy(query)
    ])
        .then(([results, ebayResults, etsyResults]) => {
            const pricesByYears = allPricesByYears(results);
            const yearsWorthIt = Object.entries(pricesByYears)
                .sort((a, b) => {
                    const aAvg = averagePrices(a[1]);
                    const bAvg = averagePrices(b[1]);
                    return bAvg - aAvg;
                })
                .map(([year]) => parseInt(year))
                .slice(0, 3);
            const abes = results.filter(b => yearsWorthIt.includes(b.year) || yearsWorthIt.includes(parseInt(b.year)));
            const avgAbePrice = averagePrices(abes.map(b => b.price)) || 0;
            const ebays = ebayResults
                .filter(e => listingHasYearOrPub(e, yearsWorthIt, searchQuery.publisher));
            const soldListings = ebays.filter(b => b.sold);
            const highestFeasiblePrice = abes.concat(soldListings)
                .map(b => b.price)
                .reduce((max, curr) => max < curr ? curr : max, 0) || 0;
            const liveListings = ebays.filter(b => !b.sold && b.price < highestFeasiblePrice);
            const avgSoldPrice = averagePrices(soldListings.map(b => b.price)) || 0;
            const avgLivePrice = averagePrices(liveListings.map(b => b.price)) || 0;
            const etsys = etsyResults
                .filter(e => listingHasYearOrPub(e, yearsWorthIt, searchQuery.publisher));
            const avgEtsyPrice = averagePrices(etsys.map(b => b.price)) || 0;
            const confidenceRating = ((abes.length + ebays.length + etsys.length) / 150 * 100).toFixed(2) + '%';
            const allPrices = abes.concat(soldListings).concat(etsys).map(b => b.price);
            const avg = averagePrices(allPrices);
            return [avg > 100 ? 2 : avg > 15 ? 1 : 0, avgAbePrice.toFixed(2), avgSoldPrice.toFixed(2), avgLivePrice.toFixed(2), avgEtsyPrice.toFixed(2), avg.toFixed(2), confidenceRating.replace(/%/, '')].map(n => parseFloat(n));
        });
};
