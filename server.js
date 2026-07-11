const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

const SUPABASE_HOST = 'knphmxxokowwkruimdus.supabase.co';
const SUPABASE_URL = `https://${SUPABASE_HOST}`;
const SUPABASE_ANON = 'sb_publishable_9b7WSJF4UlfF1JIdCDjWqQ_dxOTpqSW';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'igor.gratii.99@mail.ru';

let OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
let SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function loadEnvKeys() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    const envContent = fs.readFileSync(envPath, 'utf8');
    const openaiMatch = envContent.match(/OPENAI_API_KEY=(.*)/);
    if (openaiMatch && !OPENAI_API_KEY) {
      OPENAI_API_KEY = openaiMatch[1].trim().replace(/^["']|["']$/g, '');
    }
    const serviceKeyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
    if (serviceKeyMatch && !SUPABASE_SERVICE_ROLE_KEY) {
      SUPABASE_SERVICE_ROLE_KEY = serviceKeyMatch[1].trim().replace(/^["']|["']$/g, '');
    }
    console.log('[Server] Loaded keys from .env');
  } catch (e) {
    console.error('[Server] Failed to read .env:', e.message);
  }
}

function fetchOpenAIKeyFromDB() {
  if (OPENAI_API_KEY) return Promise.resolve();
  return new Promise((resolve) => {
    const options = {
      hostname: SUPABASE_HOST,
      path: '/rest/v1/config?key=eq.openai_api_key&select=value',
      method: 'GET',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
      timeout: 5000,
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data?.[0]?.value) {
            OPENAI_API_KEY = data[0].value.trim();
            console.log('[Server] OpenAI key fetched from DB');
          }
        } catch (_) {}
        resolve();
      });
    });
    req.on('error', () => resolve());
    req.on('timeout', () => { req.destroy(); resolve(); });
    req.end();
  });
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
  '.ico': 'image/x-icon',
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function verifyAdmin(authToken) {
  return new Promise((resolve) => {
    if (!authToken) return resolve({ ok: false, code: 401, error: 'Unauthorized' });
    const verifyReq = https.request(
      {
        hostname: SUPABASE_HOST,
        path: '/auth/v1/user',
        method: 'GET',
        headers: { apikey: SUPABASE_ANON, Authorization: authToken },
      },
      (verifyRes) => {
        let body = '';
        verifyRes.on('data', (d) => (body += d));
        verifyRes.on('end', () => {
          try {
            const user = JSON.parse(body);
            if (user?.email !== ADMIN_EMAIL) {
              return resolve({ ok: false, code: 403, error: 'Forbidden' });
            }
            resolve({ ok: true, user });
          } catch (e) {
            resolve({ ok: false, code: 500, error: e.message });
          }
        });
      }
    );
    verifyReq.on('error', (e) => resolve({ ok: false, code: 500, error: e.message }));
    verifyReq.end();
  });
}

function jsonResponse(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function handleAiImport(req, res) {
  readJsonBody(req)
    .then(({ prompt }) => {
      if (!OPENAI_API_KEY) return jsonResponse(res, 500, { error: 'OPENAI_API_KEY missing on server' });
      const aiReqData = JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a specialized data extractor. Output valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });
      const aiReq = https.request(
        {
          hostname: 'api.openai.com',
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Length': Buffer.byteLength(aiReqData),
          },
        },
        (aiRes) => {
          let aiBody = '';
          aiRes.on('data', (d) => (aiBody += d));
          aiRes.on('end', () => {
            const isJson = aiRes.headers['content-type']?.includes('application/json');
            res.writeHead(aiRes.statusCode, { 'Content-Type': isJson ? 'application/json' : 'text/plain' });
            res.end(aiBody);
          });
        }
      );
      aiReq.on('error', (e) => jsonResponse(res, 500, { error: e.message }));
      aiReq.write(aiReqData);
      aiReq.end();
    })
    .catch(() => jsonResponse(res, 400, { error: 'Invalid JSON' }));
}

async function handleAdminListUsers(req, res) {
  const authCheck = await verifyAdmin(req.headers['authorization']);
  if (!authCheck.ok) return jsonResponse(res, authCheck.code, { error: authCheck.error });
  if (!SUPABASE_SERVICE_ROLE_KEY) return jsonResponse(res, 500, { error: 'Service Role Key missing' });

  const listReq = https.request(
    {
      hostname: SUPABASE_HOST,
      path: '/auth/v1/admin/users',
      method: 'GET',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
    (listRes) => {
      let body = '';
      listRes.on('data', (d) => (body += d));
      listRes.on('end', () => {
        res.writeHead(listRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(body);
      });
    }
  );
  listReq.on('error', (e) => jsonResponse(res, 500, { error: e.message }));
  listReq.end();
}

async function handleAdminDeleteUser(req, res) {
  const authCheck = await verifyAdmin(req.headers['authorization']);
  if (!authCheck.ok) return jsonResponse(res, authCheck.code, { error: authCheck.error });
  if (!SUPABASE_SERVICE_ROLE_KEY) return jsonResponse(res, 500, { error: 'Service Role Key missing' });

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (_) {
    return jsonResponse(res, 400, { error: 'Invalid JSON' });
  }
  const { email } = payload;
  if (!email) return jsonResponse(res, 400, { error: 'email required' });

  const listReq = https.request(
    {
      hostname: SUPABASE_HOST,
      path: '/auth/v1/admin/users',
      method: 'GET',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
    (listRes) => {
      let body = '';
      listRes.on('data', (d) => (body += d));
      listRes.on('end', () => {
        try {
          const usersData = JSON.parse(body);
          const user = (usersData.users || []).find((u) => u.email === email);
          if (!user) return jsonResponse(res, 404, { error: 'User not found in Auth' });
          const delReq = https.request(
            {
              hostname: SUPABASE_HOST,
              path: `/auth/v1/admin/users/${user.id}`,
              method: 'DELETE',
              headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
            },
            (delRes) => {
              res.writeHead(delRes.statusCode, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: delRes.statusCode === 200 }));
            }
          );
          delReq.on('error', (e) => jsonResponse(res, 500, { error: e.message }));
          delReq.end();
        } catch (e) {
          jsonResponse(res, 500, { error: e.message });
        }
      });
    }
  );
  listReq.on('error', (e) => jsonResponse(res, 500, { error: e.message }));
  listReq.end();
}

function serveStatic(req, res) {
  let urlPath = req.url === '/' ? '/index.html' : req.url;
  urlPath = urlPath.split('?')[0];
  const safePath = path.normalize(urlPath).replace(/^([/\\.]+)+/, '');
  let filePath = path.join(__dirname, safePath);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      return res.end(`<h1>404 - ${urlPath} not found</h1>`);
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

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.url === '/api/ai-import' && req.method === 'POST') return handleAiImport(req, res);
  if (req.url === '/api/admin/users' && req.method === 'GET') return handleAdminListUsers(req, res);
  if (req.url === '/api/admin/delete-user' && req.method === 'POST') return handleAdminDeleteUser(req, res);

  serveStatic(req, res);
});

(async () => {
  loadEnvKeys();
  await fetchOpenAIKeyFromDB();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Kultura server listening on http://0.0.0.0:${PORT}`);
    console.log(`Emulator: http://10.0.2.2:${PORT}`);
  });
})();
