const {JSDOM} = require('jsdom');
const toURL = search => `https://www.etsy.com/search/vintage/books-movies-and-music/books?q=${encodeURIComponent(search)}&explicit=1`;

module.exports = query => {
    return JSDOM.fromURL(toURL(query))
        .then(dom => {
            const results = Array.from(dom.window.document.querySelectorAll('.listing-link'));

            if (results.length) {
                return results
                    .filter(a => a.querySelector('.currency-value'))
                    .map(a => ({
                        about: a.getAttribute('title'),
                        price: parseFloat(a.querySelector('.currency-value').textContent)
                    }));
            }

            return [];
        })
        .catch(() => {
            return [];
        });
};
