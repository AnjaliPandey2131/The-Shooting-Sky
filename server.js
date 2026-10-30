const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 8080;
const base = path.resolve(__dirname);

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }

  if (urlPath === '/' || urlPath === '/index.html') {
    urlPath = '/index.html';
  }
  const filePath = path.resolve(base, `.${urlPath}`);
  const relativePath = path.relative(base, filePath);
  if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const stream = fs.createReadStream(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    };
    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
    stream.on('error', () => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.statusCode = 500;
      res.end('Unable to read file');
    });
    stream.pipe(res);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Server listening on http://localhost:${port}/`);
});
