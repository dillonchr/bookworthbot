//  must include env var of EBAY_API_KEY
const bookmancy = require('@dillonchr/bookmancy');
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

const allPricesByYears = listings => fixedYears(listings || [])
    .reduce((years, book) => {
        if (!years[book.year]) {
            years[book.year] = [];
        }
        years[book.year].push(book.price);
        return years;
    }, {});

const averagePrices = prices => prices.reduce((s, c) => s + parseFloat(typeof c === 'string' ? c.replace(/,/g, '') : c), 0) / prices.length;
const listingHasYearOrPub = (listing, years, publisher) => {
    try {
        return years.some(y => listing.about.includes(y)) || listing.about.toLowerCase().includes(publisher.toLowerCase());
    } catch (ignore) {
        return false;
    }
};

const searchEbay = (query) => {
    return new Promise((res, rej) => {
        bookmancy.ebay(query, (err, results) => {
            if (err) {
                res([]);
            }
            res(results ? results.results : []);
        });
    });
};

const searchAbe = (query) => {
    return new Promise((res, rej) => {
        bookmancy.abe(query, (err, results) => {
            if (err) {
                res([]);
            }
            res(results ? results.results : []);
        });
    });
};

const handleEtsyResults = (searchQuery, results, yearsWorthIt) => {
    const etsys = results
        .filter(e => listingHasYearOrPub(e, yearsWorthIt, searchQuery.publisher));
    return {avgEtsyPrice: averagePrices(etsys.map(b => b.price)) || 0, etsys};
};

const handleEbayResults = (searchQuery, soldResults, liveResults, yearsWorthIt, abes) => {
    const soldListings = soldResults.filter(b => listingHasYearOrPub(b, yearsWorthIt, searchQuery.publisher));
    const highestFeasiblePrice = abes.concat(soldListings)
        .map(b => b.price)
        .reduce((max, curr) => max < curr ? curr : max, 0) || 0;
    const liveListings = liveResults.filter(b => b.price < highestFeasiblePrice && listingHasYearOrPub(b, yearsWorthIt, searchQuery.publisher));
    const avgSoldPrice = averagePrices(soldListings.map(b => b.price)) || 0;
    const avgLivePrice = averagePrices(liveListings.map(b => b.price)) || 0;

    return {soldListings, liveListings, avgSoldPrice, avgLivePrice};
};

const handleAbeResults = (results, yearsWorthIt) => {
    const abes = results.filter(b => b.price !== '???' && (yearsWorthIt.includes(b.year) || yearsWorthIt.includes(parseInt(b.year))));
    const avgAbePrice = averagePrices(abes.map(b => b.price)) || 0;

    return {abes, avgAbePrice};
};

const getYearsWorthIt = (pricesByYears) => {
    return Object.entries(pricesByYears)
        .sort((a, b) => {
            const aAvg = averagePrices(a[1]);
            const bAvg = averagePrices(b[1]);
            return bAvg - aAvg;
        })
        .map(([year]) => parseInt(year))
        .slice(0, 3);
};

const toDisplay = (n) => {
    return Math.round(n * 100) / 100;
};

module.exports = searchQuery => {
    if (!searchQuery) {
        return null;
    }
    const query = searchQuery.title + ' ' + searchQuery.author;

    return Promise.all([
        searchAbe(searchQuery),
        searchEbay({...searchQuery, live: 1}),
        searchEbay({...searchQuery, sold: 1}),
        etsy(query)
    ])
        .then(([abeResults, soldEbayResults, liveEbayResults, etsyResults]) => {
            const pricesByYears = allPricesByYears(abeResults);
            const yearsWorthIt = getYearsWorthIt(pricesByYears);

            const {abes, avgAbePrice} = handleAbeResults(abeResults, yearsWorthIt);
            const {soldListings, liveListings, avgSoldPrice, avgLivePrice} = handleEbayResults(searchQuery, soldEbayResults, liveEbayResults, yearsWorthIt, abes);
            const {avgEtsyPrice, etsys} = handleEtsyResults(searchQuery, etsyResults, yearsWorthIt);

            const confidenceRating = ((abes.length + soldListings.length + liveListings.length + etsys.length) / 150 * 100).toFixed(2) + '%';
            const allPrices = abes.concat(soldListings).concat(etsys).map(b => b.price);
            const avg = averagePrices(allPrices) || 0;

            return {
                shouldBuy: avg > 100 ? 2 : avg > 15 ? 1 : 0,
                avgAbePrice: toDisplay(avgAbePrice),
                avgSoldPrice: toDisplay(avgSoldPrice),
                avgLivePrice: toDisplay(avgLivePrice),
                avgEtsyPrice: toDisplay(avgEtsyPrice),
                avg: toDisplay(avg),
                confidence: toDisplay(parseFloat(confidenceRating.replace(/%/, '')))
            };
        });
};
