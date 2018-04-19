const http = require('http');
const fs = require('fs');
const bookworth = require('./bookworth');
const url = require('url');
const app = http.createServer((req, res) => {
    const serveHTML = req.url === '/';
    const contentType = serveHTML ? 'text/html' : 'application/json';

    if (serveHTML) {
        fs.readFile('./index.html', (error, content) => {
            if (error) {
                const status = error.code === 'ENOENT' ? 404 : 500;
                res.writeHead(status, {'Content-Type': 'text/plain'});
                res.end(status.toString());
            } else {
                res.writeHead(200, {'Content-Type': contentType});
                res.end(content, 'utf-8');
            }
        });
    } else {
        bookworth(url.parse(req.url, true).query)
            .then(r => res.end(JSON.stringify(r), contentType));
    }
});
app.listen(process.env.PORT || 1234);
