const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

// Încărcăm cheia din .env dacă există
let OPENAI_API_KEY = '';
try {
  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/OPENAI_API_KEY=(.*)/);
  if (match) OPENAI_API_KEY = match[1].trim();
} catch (e) {
  console.warn("Avertisment: Nu s-a putut citi fișierul .env. AI Import s-ar putea să nu funcționeze.");
}

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // --- ENDPOINT PENTRU AI IMPORT ---
  if (req.url === '/api/ai-import' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { prompt } = JSON.parse(body);

        const aiReqData = JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a specialized data extractor. Output valid JSON only." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        });

        const options = {
          hostname: 'api.openai.com',
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Length': Buffer.byteLength(aiReqData)
          }
        };

        const aiReq = https.request(options, (aiRes) => {
          let aiBody = '';
          aiRes.on('data', d => aiBody += d);
          aiRes.on('end', () => {
            res.writeHead(aiRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(aiBody);
          });
        });

        aiReq.on('error', (e) => {
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        });

        aiReq.write(aiReqData);
        aiReq.end();

      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Invalid JSON request" }));
      }
    });
    return;
  }

  // --- SERVIRE FIȘIERE STATICE ---
  let urlPath = req.url === '/' ? '/index.html' : req.url;
  urlPath = urlPath.split('?')[0];

  let filePath = path.join(__dirname, urlPath);

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT' || error.code === 'EISDIR') {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(`<h1>404 - Fișierul ${urlPath} nu a fost găsit</h1>`, 'utf-8');
        } else {
          res.writeHead(500);
          res.end(`Server Error: ${error.code}`, 'utf-8');
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Kultura Web Server pornit!`);
  console.log(`📍 Local:   http://localhost:${PORT}`);
  console.log(`📱 Emulator: http://10.0.2.2:${PORT}`);
  console.log(`==================================================\n`);
});
