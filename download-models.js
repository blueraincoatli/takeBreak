const https = require('https');
const fs = require('fs');

function download(url, dest, label) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        console.log(label + ': HTTP ' + res.statusCode);
        res.destroy();
        resolve('HTTP ' + res.statusCode);
        return;
      }
      const size = parseInt(res.headers['content-length'] || 0);
      const file = fs.createWriteStream(dest);
      let downloaded = 0;
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        file.write(chunk);
        if (size > 0) {
          process.stdout.write('\r' + label + ': ' + Math.round(downloaded / size * 100) + '%  ');
        }
      });
      res.on('end', () => {
        file.end(() => {
          const actual = fs.statSync(dest).size;
          console.log('\n' + label + ' done: ' + actual + ' bytes');
          resolve('OK');
        });
      });
      res.on('error', (e) => {
        file.close();
        resolve(e.message);
      });
    });
    req.on('error', (e) => resolve(e.message));
    req.on('timeout', () => {
      req.destroy();
      resolve('TIMEOUT');
    });
  });
}

(async () => {
  if (!fs.existsSync('D:/takeBreak/models')) {
    fs.mkdirSync('D:/takeBreak/models', { recursive: true });
  }

  await download(
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    'D:/takeBreak/models/face_landmarker.task',
    'Face'
  );

  await download(
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    'D:/takeBreak/models/hand_landmarker.task',
    'Hand'
  );

  const files = fs.readdirSync('D:/takeBreak/models');
  console.log('\nModels folder contents:');
  for (const f of files) {
    const s = fs.statSync('D:/takeBreak/models/' + f).size;
    console.log('  ' + f + ' (' + (s / 1024 / 1024).toFixed(1) + ' MB)');
  }
})();
