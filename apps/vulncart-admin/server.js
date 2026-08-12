const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 3200);
const basePath = (process.env.BASE_PATH || '/admin').replace(/\/$/, '') || '';
const root = path.join(__dirname, 'public');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function stripBase(urlPath) {
  if (!basePath) return urlPath || '/';
  if (urlPath === basePath || urlPath === basePath + '/') return '/';
  if (urlPath.startsWith(basePath + '/')) return urlPath.slice(basePath.length) || '/';
  return urlPath || '/';
}

http
  .createServer((req, res) => {
    const raw = decodeURIComponent((req.url || '/').split('?')[0]);
    const urlPath = stripBase(raw);
    const filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': types[path.extname(filePath)] || 'application/octet-stream',
      });
      res.end(data);
    });
  })
  .listen(port, () => console.log(`VulnCart admin on :${port} base=${basePath}`));
