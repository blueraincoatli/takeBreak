// Pure Node.js static file server — no Electron dependency
// Serves: HTML files + ML model files
// Used as fallback when Electron can't start properly
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3721;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=31536000');

  // Strip query string
  const urlPath = req.url.split('?')[0];

  // /health — health check
  if (urlPath === '/health') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: 'ok', app: 'takebreak-static', port: PORT }));
  }

  // /api/scene-close — for closing the scene window
  if (req.method === 'POST' && urlPath === '/api/scene-close') {
    console.log('[TakeBreak] scene-close called (static mode — no window to close)');
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  if (req.method !== 'GET') {
    res.writeHead(405);
    return res.end('Method not allowed');
  }

  // /models/... — serve model files
  if (urlPath.startsWith('/models/')) {
    const file = urlPath.slice('/models/'.length);
    const filePath = path.join(ROOT, 'models', file);
    if (!filePath.startsWith(path.join(ROOT, 'models'))) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      return res.end('Model not found: ' + file);
    }
    const ext = path.extname(file);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Content-Length', fs.statSync(filePath).size);
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // /*.html — serve static HTML
  if (urlPath.endsWith('.html')) {
    const file = urlPath.slice(1);
    const filePath = path.join(ROOT, file);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(ROOT))) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    if (!fs.existsSync(resolved)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    fs.createReadStream(resolved).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end('Not found. Try /health, /models/, or *.html');
});

server.listen(PORT, () => {
  console.log(`[TakeBreak static server] Running on http://localhost:${PORT}`);
  console.log('  HTML files: http://localhost:' + PORT + '/test-full-body.html');
  console.log('  Models:     http://localhost:' + PORT + '/models/pose_landmarker_lite.task');
});
