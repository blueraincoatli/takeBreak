// Check which WASM files we need and their sizes
const https = require('https');
const http = require('http');

function check(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      resolve(res.statusCode + ' size=' + (res.headers['content-length'] || '?'));
      res.destroy();
    });
    req.on('error', (e) => resolve('ERR:' + e.message));
    req.on('timeout', () => { req.destroy(); resolve('TIMEOUT'); });
  });
}

(async () => {
  // tasks-vision WASM files
  const wasmFiles = [
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_internal.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_wasm_internal.wasm',
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm/vision_wasm_internal.wasm',
  ];
  console.log('tasks-vision WASM files:');
  for (const f of wasmFiles) {
    console.log('  ' + f.split('/').pop() + ':', await check(f));
  }

  // Face Mesh WASM (needed by the old API)
  const faceFiles = [
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm',
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_wasm_bin.wasm',
  ];
  console.log('\nFace Mesh files:');
  for (const f of faceFiles) {
    console.log('  ' + f.split('/').pop() + ':', await check(f));
  }
})();
