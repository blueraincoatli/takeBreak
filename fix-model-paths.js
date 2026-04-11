const fs = require('fs');

let html = fs.readFileSync('D:/takeBreak/test-full-body.html', 'utf8');

// Normalize all modelAssetPath to absolute localhost URLs
html = html.replace(/modelAssetPath: '[^']+'/g, (m) => {
  if (m.includes('pose_landmarker')) return "modelAssetPath: 'http://localhost:3721/models/pose_landmarker_lite.task'";
  if (m.includes('face_landmarker')) return "modelAssetPath: 'http://localhost:3721/models/face_landmarker.task'";
  if (m.includes('hand_landmarker')) return "modelAssetPath: 'http://localhost:3721/models/hand_landmarker.task'";
  return m;
});

fs.writeFileSync('D:/takeBreak/test-full-body.html', html, 'utf8');
console.log('Done. All modelAssetPath lines:');
html.split('\n').filter(l => l.includes('modelAssetPath')).forEach(l => console.log(' ', l.trim()));
