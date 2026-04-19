import base64
png_path = r'D:\takeBreak\scenes\breathing\claude-logo-dark.png'
with open(png_path, 'rb') as f:
    b64 = base64.b64encode(f.read()).decode()
data_uri = f'data:image/png;base64,{b64}'

# SVG: 400x160 units, logo at (0,0) 320x69px (centered)
# Each SVG tile = 400x160px
# CSS background-size: 400px 160px will tile this every 400x160px
# Logo 320x69, gap = 80px horiz, 91px vert
svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="160" patternUnits="userSpaceOnUse">
  <image href="{data_uri}" width="320" height="69" x="40" y="45" preserveAspectRatio="xMidYMid meet"/>
</svg>'''

with open(r'D:\takeBreak\scenes\breathing\logo-brick.svg', 'w', encoding='utf-8') as f:
    f.write(svg)
print(f'done, SVG={len(svg)} bytes')
