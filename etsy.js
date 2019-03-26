const domget = require('@dillonchr/domget');
const toURL = search => `https://www.etsy.com/search/vintage/books-movies-and-music/books?q=${encodeURIComponent(search)}&explicit=1`;

module.exports = query => {
    return new Promise((res) => {
        domget(toURL(query), (err, dom) => {
            if (err || !dom) {
                return res([]);
            }
            const results = Array.from(dom.querySelectorAll('.listing-link'));

            if (results.length) {
                return res(results
                    .filter(a => a.querySelector('.currency-value'))
                    .map(a => ({
                        about: a.getAttribute('title'),
                        price: parseFloat(a.querySelector('.currency-value').textContent)
                    })));
            }
            res([]);
        });
    });
};

