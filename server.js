const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

// Configurații Supabase
const SUPABASE_URL = 'https://knphmxxokowwkruimdus.supabase.co';
const SUPABASE_ANON = 'sb_publishable_9b7WSJF4UlfF1JIdCDjWqQ_dxOTpqSW';

let OPENAI_API_KEY = '';
let SUPABASE_SERVICE_ROLE_KEY = '';

// Funcție pentru a prelua cheile din .env
function loadEnvKeys() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');

      const openaiMatch = envContent.match(/OPENAI_API_KEY=(.*)/);
      if (openaiMatch) OPENAI_API_KEY = openaiMatch[1].trim().replace(/^["']|["']$/g, '');

      const serviceKeyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
      if (serviceKeyMatch) SUPABASE_SERVICE_ROLE_KEY = serviceKeyMatch[1].trim().replace(/^["']|["']$/g, '');

      console.log("✅ [Server] Cheile preluate din .env");
    }
  } catch (e) {
    console.error("❌ [Server] Eroare la citirea .env:", e.message);
  }
}

// Funcție pentru a prelua cheia OpenAI din Supabase dacă lipsește în .env
async function fetchOpenAIKeyFromDB() {
  if (OPENAI_API_KEY) return;
  console.log("🔍 [AI] Căutăm cheia OpenAI în Supabase...");
  return new Promise((resolve) => {
    const options = {
      hostname: 'knphmxxokowwkruimdus.supabase.co',
      path: '/rest/v1/config?key=eq.openai_api_key&select=value',
      method: 'GET',
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${SUPABASE_ANON}` },
      timeout: 5000
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data?.[0]?.value) {
            OPENAI_API_KEY = data[0].value.trim();
            console.log("✅ [AI] Cheie preluată din DB");
          }
        } catch (e) {}
        resolve();
      });
    });
    req.on('error', () => resolve());
    req.end();
  });
}

(async () => {
  loadEnvKeys();
  await fetchOpenAIKeyFromDB();
})();

const mimeTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API: AI IMPORT ---
  if (req.url === '/api/ai-import' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      if (!OPENAI_API_KEY) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: "OpenAI Key missing" }));
      }
      try {
        const { prompt } = JSON.parse(body);
        const aiReqData = JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: "Extract to JSON" }, { role: "user", content: prompt }],
          response_format: { type: "json_object" }
        });
        const options = {
          hostname: 'api.openai.com', path: '/v1/chat/completions', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` }
        };
        const aiReq = https.request(options, aiRes => {
          let aiBody = '';
          aiRes.on('data', d => aiBody += d);
          aiRes.on('end', () => {
            res.writeHead(aiRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(aiBody);
          });
        });
        aiReq.on('error', e => {
          res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
        });
        aiReq.write(aiReqData); aiReq.end();
      } catch (err) {
        res.writeHead(400); res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  // --- API: ADMIN DELETE USER ---
  if (req.url === '/api/admin/delete-user' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: "Service Role Key missing" }));
      }
      try {
        const { email } = JSON.parse(body);
        console.log(`[Admin] Cerere ștergere email: ${email}`);

        // 1. Get User ID
        const listReq = https.request({
          hostname: 'knphmxxokowwkruimdus.supabase.co',
          path: '/auth/v1/admin/users',
          method: 'GET',
          headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
        }, listRes => {
          let listBody = '';
          listRes.on('data', d => listBody += d);
          listRes.on('end', () => {
            try {
              const usersData = JSON.parse(listBody);
              const user = (usersData.users || []).find(u => u.email === email);
              if (!user) {
                res.writeHead(404);
                return res.end(JSON.stringify({ error: "User not found in Auth" }));
              }

              // 2. Delete User
              const delReq = https.request({
                hostname: 'knphmxxokowwkruimdus.supabase.co',
                path: `/auth/v1/admin/users/${user.id}`,
                method: 'DELETE',
                headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
              }, delRes => {
                res.writeHead(delRes.statusCode);
                res.end(JSON.stringify({ success: delRes.statusCode === 200 }));
              });
              delReq.end();
            } catch (e) {
              res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
            }
          });
        });
        listReq.end();
      } catch (err) {
        res.writeHead(400); res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  // --- SERVIRE FIȘIERE STATICE ---
  let urlPath = req.url === '/' ? '/index.html' : req.url;
  urlPath = urlPath.split('?')[0];
  const safePath = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;
  let filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(`<h1>404 - Negăsit</h1>`);
      return;
    }
    if (stats.isDirectory()) filePath = path.join(filePath, 'index.html');
    const ext = String(path.extname(filePath)).toLowerCase();
    const type = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(500); res.end(`Error: ${error.code}`);
      } else {
        res.writeHead(200, { 'Content-Type': type }); res.end(content);
      }
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server Kultura activ la port ${PORT}`);
});
