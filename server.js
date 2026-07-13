// Local development static server ONLY.
// Production hosting is GitHub Pages; AI import and admin operations run as
// Supabase Edge Functions (ai-import, admin-list-users, admin-delete-user),
// which hold their own secrets. This server has no keys and no API routes.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (s) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]
  ));
}

function serveStatic(req, res) {
  let urlPath = req.url === '/' ? '/index.html' : req.url;
  urlPath = urlPath.split('?')[0];
  try {
    urlPath = decodeURIComponent(urlPath);
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Bad Request');
  }
  const safePath = path.normalize(urlPath).replace(/^([/\\.]+)+/, '');
  let filePath = path.join(__dirname, safePath);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`<h1>404 - ${escapeHtml(urlPath)} not found</h1>`);
    }
    if (stats.isDirectory()) filePath = path.join(filePath, 'index.html');
    const ext = String(path.extname(filePath)).toLowerCase();
    const type = mimeTypes[ext] || 'application/octet-stream';
    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(500);
        return res.end(`Server Error: ${error.code}`);
      }
      res.writeHead(200, { 'Content-Type': type });
      res.end(content);
    });
  });
}

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Kultura dev server listening on http://0.0.0.0:${PORT}`);
  console.log(`Emulator: http://10.0.2.2:${PORT}`);
});
