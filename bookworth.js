const bookmancy = require('bookmancy');
const etsy = require('./etsy');

//  search abe for (title, author, publisher)
//  search for most valuable year of publisher
//  search ebay for title/author
//  filter any results that meet publisher or year
//  respond to user with top 3 years and approx value
//  if value is over $15

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

const averagePrices = prices => prices.reduce((s,c) => s + parseFloat(c), 0) / prices.length;

module.exports = searchQuery => {
    const query = searchQuery.title + ' ' + searchQuery.author;

    return Promise.all([
        bookmancy.abe.search(searchQuery),
        Promise.all([
            bookmancy.ebay.searchLiveListings(query).catch(() => []),
            bookmancy.ebay.searchSoldListings(query).catch(() => [])
        ]).then(r => r.reduce((s,c) => s.concat(c), [])),
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
                .filter(e => yearsWorthIt.some(y => e.about.includes(y)) || e.about.includes(searchQuery.publisher));
            const soldListings = ebays.filter(b => b.sold);
            const highestFeasiblePrice = abes.concat(soldListings)
                .map(b => b.price)
                .reduce((max, curr) => max < curr ? curr : max, 0) || 0;
            const liveListings = ebays.filter(b => !b.sold && b.price < highestFeasiblePrice);
            const avgSoldPrice = averagePrices(soldListings.map(b => b.price)) || 0;
            const avgLivePrice = averagePrices(liveListings.map(b => b.price)) || 0;
            // console.log('ABE', abes.length, avgAbePrice.toFixed(2));
            // console.log('EBAY', 'SOLD', avgSoldPrice.toFixed(2), 'LIVE', avgLivePrice.toFixed(2));
            const etsys = etsyResults
                .filter(e => yearsWorthIt.some(y => e.about.includes(y)) || e.about.includes(searchQuery.publisher));
            const avgEtsyPrice = averagePrices(etsys.map(b => b.price)) || 0;
            // console.log('ETSY', avgEtsyPrice.toFixed(2));
            const confidenceRating = ((abes.length + ebays.length + etsys.length) / 150 * 100).toFixed(2) + '%';
            const allPrices = abes.concat(soldListings).concat(etsys).map(b => b.price);
            // console.log('AVG', averagePrices(allPrices).toFixed(2));
            // console.log('CONF', confidenceRating);
            const avg = averagePrices(allPrices);
            const response = [avg > 100 ? 2 : avg > 15 ? 1 : 0, avgAbePrice.toFixed(2), avgSoldPrice.toFixed(2), avgLivePrice.toFixed(2), avgEtsyPrice.toFixed(2), avg.toFixed(2), confidenceRating.replace(/%/, '')].map(n => parseFloat(n));
            // console.log(JSON.stringify(response));
            return response;
            // console.log({
            //     abe: avgAbePrice.toFixed(2),
            //     ebay: {
            //         s: avgSoldPrice.toFixed(2),
            //         l: avgLivePrice.toFixed(2)
            //     },
            //     etsy: avgEtsyPrice.toFixed(2),
            //     avg: avg.toFixed(2),
            //     conf: confidenceRating
            // });
        });
};
