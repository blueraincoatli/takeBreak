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

// Lazy electron getter - resolves after browser_init has run
function getElectron() {
  const Module = require('module');
  const cached = Module._cache['electron'];
  if (cached) return cached.exports;
  // Try direct require (may work if _resolveFilename is patched)
  try {
    const e = require('electron');
    if (e && typeof e === 'object' && e.app) return e;
  } catch (_) {}
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

async function showRandomScene() {
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

  const sceneName = scenes[Math.floor(Math.random() * scenes.length)];
  const sceneDir = path.join(SCENES_DIR, sceneName);
  const scenePath = path.join(sceneDir, 'index.html');

  let screenshotPath = null;
  try {
    screenshotPath = await captureScreen();
  } catch (e) {
    console.log(`[TakeBreak] Screenshot failed: ${e.message}`);
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

  currentWindow.loadFile(scenePath);

  currentWindow.once('ready-to-show', () => {
    currentWindow.show();
  });

  currentWindow.webContents.on('did-finish-load', () => {
    if (screenshotPath && fs.existsSync(screenshotPath)) {
      const escapedPath = screenshotPath.replace(/\\/g, '/');
      currentWindow.webContents.executeJavaScript(
        `if(document.querySelector('.bg-screenshot')){document.querySelector('.bg-screenshot').style.backgroundImage='url("file:///${escapedPath}")'}`
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

  if (req.method !== 'GET') {
    res.writeHead(405);
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  if (req.url === '/heartbeat' || req.url === '/remind') {
    showRandomScene().then(() => {
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

// Use setImmediate to defer electron access until after browser_init
setImmediate(() => {
  const electron = getElectron();
  if (!electron) {
    console.error('[TakeBreak] Failed to get electron module');
    process.exit(1);
    return;
  }

  const { app } = electron;

  // Single instance lock
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }

  app.whenReady().then(() => {
    server.listen(PORT, () => {
      console.log(`[TakeBreak] v1.0.0`);
      console.log(`  Heartbeat: http://localhost:${PORT}/heartbeat`);
      console.log(`  Health:    http://localhost:${PORT}/health`);
      console.log(`  Scenes:    ${getScenes().join(', ') || '(none)'}`);
    });
  });

  app.on('window-all-closed', () => {
    // Keep running in background
  });
});
