// TakeBreak main.js - Deferred electron loading
// electron module is only available after browser_init runs
// We use a lazy getter pattern to avoid the timing issue

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3721;
const SCENES_DIR = path.join(__dirname, 'scenes');

let currentWindow = null;

// Lazy electron getter
function getElectron() {
  // Method 1: process.versions.electron means we're inside Electron — built-in require works
  if (process.versions && process.versions.electron) {
    try {
      const e = require('electron');
      if (e && typeof e === 'object' && (e.app || e.BrowserWindow)) return e;
    } catch (_) {}
  }

  // Method 2: Try loading from the actual electron binary path
  try {
    const path = require('path');
    const distDir = path.join(__dirname, 'node_modules', 'electron', 'dist');
    const electronExe = path.join(distDir, 'electron.exe');
    if (require('fs').existsSync(electronExe)) {
      // Use require with an explicit paths option to load electron from node_modules
      const e = require('electron');
      if (e && typeof e === 'object' && (e.app || e.BrowserWindow)) return e;
    }
  } catch (_) {}

  // Method 3: npm package shadowing — bypass via require.resolve
  try {
    const Module = require('module');
    const npmPath = require.resolve('electron');
    delete Module._cache[npmPath];
    const real = require('electron');
    if (real && typeof real === 'object' && (real.app || real.BrowserWindow)) return real;
  } catch (_) {}

  // Method 4: check what require('electron') actually returns
  try {
    const raw = require('electron');
    console.log('[TakeBreak DEBUG] require("electron") type:', typeof raw);
    if (typeof raw === 'string') {
      console.log('[TakeBreak DEBUG] returns path:', raw.slice(-60));
      // This is the npm package — try to load the actual Electron module
      // by resolving from node_modules/electron/dist
      const Module = require('module');
      const paths = Module._nodeModulePaths(path.join(__dirname, 'node_modules'));
      const resolved = Module._resolveFilename('electron', null, false, {paths});
      console.log('[TakeBreak DEBUG] resolved to:', resolved);
      if (resolved && resolved.includes('node_modules/electron/dist')) {
        delete Module._cache[require.resolve('electron')];
        const e = require(resolved);
        if (e && typeof e === 'object') return e;
      }
    }
  } catch (e) {
    console.log('[TakeBreak DEBUG] method4 error:', e.message);
  }

  console.log('[TakeBreak DEBUG] All methods failed, electron unavailable');
  return null;
}

function getScenes() {
  if (!fs.existsSync(SCENES_DIR)) return [];
  return fs.readdirSync(SCENES_DIR).filter(f =>
    fs.statSync(path.join(SCENES_DIR, f)).isDirectory() &&
    fs.existsSync(path.join(SCENES_DIR, f, 'index.html'))
  );
}

async function captureScreen() {
  const electron = getElectron();
  if (!electron) return null;
  const { desktopCapturer, screen } = electron;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  const scaleFactor = primaryDisplay.scaleFactor;
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: Math.round(width * scaleFactor), height: Math.round(height * scaleFactor) }
  });
  if (sources.length === 0) return null;
  const screenshotPath = path.join(os.tmpdir(), 'takebreak-bg.png');
  fs.writeFileSync(screenshotPath, sources[0].thumbnail.toPNG());
  return screenshotPath;
}

async function showRandomScene(sceneName) {
  const electron = getElectron();
  if (!electron) {
    console.log('[TakeBreak] Electron not ready yet');
    return;
  }
  const { BrowserWindow } = electron;

  if (currentWindow && !currentWindow.isDestroyed()) {
    currentWindow.close();
    currentWindow = null;
  }

  const scenes = getScenes();
  if (scenes.length === 0) {
    console.log('[TakeBreak] No scenes available');
    return;
  }

  // Use provided scene name or pick random
  if (!sceneName || !scenes.includes(sceneName)) {
    sceneName = scenes[Math.floor(Math.random() * scenes.length)];
  }
  const sceneDir = path.join(SCENES_DIR, sceneName);
  const scenePath = path.join(sceneDir, 'index.html');

  let screenshotPath = null;
  try {
    screenshotPath = await captureScreen();
  } catch (e) {
    console.log(`[TakeBreak] Screenshot failed: ${e.message}`);
  }

  // Close previous scene window if any
  if (currentWindow && !currentWindow.isDestroyed()) {
    currentWindow.close();
    currentWindow = null;
  }

  currentWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    frame: false,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  currentWindow.loadURL(`http://localhost:${PORT}/scenes/${sceneName}/index.html?t=${Date.now()}`);

  currentWindow.once('ready-to-show', () => {
    currentWindow.show();
  });

  currentWindow.webContents.on('did-finish-load', () => {
    if (screenshotPath && fs.existsSync(screenshotPath)) {
      const imgData = fs.readFileSync(screenshotPath);
      const base64 = imgData.toString('base64');
      currentWindow.webContents.executeJavaScript(
        `if(document.querySelector('.bg-screenshot')){document.querySelector('.bg-screenshot').style.backgroundImage='url("data:image/png;base64,${base64}")'}`
      ).catch(() => {});
    }
  });

  currentWindow.on('closed', () => {
    currentWindow = null;
  });

  console.log(`[TakeBreak] Scene "${sceneName}" triggered`);
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // POST /api/scene-complete — called by a scene when it wants to close
  if (req.method === 'POST' && req.url === '/api/scene-complete') {
    if (currentWindow && !currentWindow.isDestroyed()) {
      currentWindow.close();
      currentWindow = null;
    }
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', action: 'window_closed' }));
    return;
  }

  // GET /models/* — serve model files from public/models/
  if (req.method === 'GET' && req.url.startsWith('/models/')) {
    const modelFile = req.url.slice('/models/'.length);
    const modelPath = path.join(__dirname, 'public', 'models', modelFile);
    if (!fs.existsSync(modelPath)) {
      res.writeHead(404);
      return res.end(JSON.stringify({ error: 'Model not found: ' + modelFile }));
    }
    const ext = path.extname(modelFile);
    const mimeTypes = {
      '.task': 'application/octet-stream',
      '.wasm': 'application/wasm',
      '.js': 'application/javascript',
      '.mjs': 'application/javascript',
    };
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Length', fs.statSync(modelPath).size);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    fs.createReadStream(modelPath).pipe(res);
    return;
  }

  // GET /scenes/* — serve scene files (index.html + assets)
  if (req.method === 'GET' && req.url.startsWith('/scenes/')) {
    const sceneFile = req.url.slice('/scenes/'.length).split('?')[0];
    const sceneFilePath = path.join(__dirname, 'scenes', sceneFile);
    const resolved = path.resolve(sceneFilePath);
    if (!resolved.startsWith(path.resolve(path.join(__dirname, 'scenes')))) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    if (!fs.existsSync(resolved)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(resolved);
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript',
      '.mjs': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.webm': 'video/webm',
    };
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    fs.createReadStream(resolved).pipe(res);
    return;
  }

  // GET /*.html — serve static HTML files (e.g. /test-full-body.html)
  // Only serves files inside the takebreak directory (security)
  if (req.method === 'GET' && req.url.endsWith('.html')) {
    const htmlFile = req.url.slice(1);
    const htmlPath = path.join(__dirname, htmlFile);
    // Security: ensure the resolved path is inside __dirname
    const resolved = path.resolve(htmlPath);
    if (!resolved.startsWith(path.resolve(__dirname))) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    if (!fs.existsSync(resolved)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    fs.createReadStream(resolved).pipe(res);
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  if (req.url === '/heartbeat' || req.url === '/remind' || req.url.startsWith('/remind?') || req.url.startsWith('/heartbeat?')) {
    // Parse ?scene= query param for testing
    let sceneName = null;
    try {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      sceneName = url.searchParams.get('scene');
    } catch(_) {}

    showRandomScene(sceneName).then(() => {
      res.end(JSON.stringify({ status: 'ok', action: 'scene_triggered', scenes: getScenes() }));
    }).catch(err => {
      res.writeHead(500);
      res.end(JSON.stringify({ status: 'error', message: err.message }));
    });
    return;
  }

  if (req.url === '/health') {
    res.end(JSON.stringify({ status: 'ok', app: 'takebreak', scenes: getScenes(), uptime: process.uptime() }));
    return;
  }

  if (req.url === '/scenes') {
    const scenes = getScenes().map(name => {
      const manifestPath = path.join(SCENES_DIR, name, 'manifest.json');
      let meta = {};
      if (fs.existsSync(manifestPath)) {
        try { meta = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (_) {}
      }
      return { id: name, ...meta };
    });
    res.end(JSON.stringify({ scenes }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found', endpoints: ['/heartbeat', '/health', '/scenes'] }));
});

// Initialize Electron app
const electron = getElectron();
if (!electron) {
  console.error('[TakeBreak] Failed to get electron module');
  process.exit(1);
}

const { app } = electron;

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[TakeBreak] Another instance is running, quitting');
  app.quit();
} else {
  app.on('window-all-closed', () => {
    // Keep running in background
  });

  // Debug: log when app is about to quit
  app.on('before-quit', (e) => {
    console.log('[TakeBreak] App is about to quit');
  });

  app.whenReady().then(() => {
    server.listen(PORT, () => {
      console.log(`[TakeBreak] v1.0.0`);
      console.log(`  Heartbeat: http://localhost:${PORT}/heartbeat`);
      console.log(`  Health:    http://localhost:${PORT}/health`);
      console.log(`  Scenes:    ${getScenes().join(', ') || '(none)'}`);
    });
  });
}
