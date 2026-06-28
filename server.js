import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.join(__dirname, '.env.local') });

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);

  // API routes
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.replace('/api/', '').replace(/\/$/, '');

    // Add Express-compatible helpers
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(body));
      }
    };

    // Parse JSON body (Express does this automatically; plain Node does not)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const raw = await new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString()));
        req.on('error', reject);
      });
      try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    }

    // Parse query string (Express provides req.query; plain Node does not)
    req.query = Object.fromEntries(url.searchParams);

    try {
      // Cache-bust so file edits are picked up without restarting the server
      const mod = await import(`./api/${name}.js?v=${Date.now()}`);
      await mod.default(req, res);
    } catch (e) {
      console.error('API error:', e);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    }
    return;
  }

  // Static files
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(filePath)) filePath = path.join(__dirname, 'index.html');

  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(3000, () => console.log('Ready at http://localhost:3000'));
