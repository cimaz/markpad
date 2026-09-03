'use strict';

/* Renders build/icon.svg to build/icon.png (1024x1024) plus the multi-size
   build/icons/ set that Linux hicolor themes expect, using Electron itself —
   no image toolchain (rsvg / ImageMagick / sharp) required.

   Run with:  npm run icon                                              */

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'build', 'icon.svg');
const pngPath = path.join(root, 'build', 'icon.png');
const iconsDir = path.join(root, 'build', 'icons');
const SIZE = 1024;
const LINUX_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const svg = fs.readFileSync(svgPath, 'utf-8');
  const html = `<!DOCTYPE html><meta charset="utf-8">
    <style>
      html,body{margin:0;padding:0;background:transparent;width:${SIZE}px;height:${SIZE}px;overflow:hidden}
      svg{display:block;width:${SIZE}px;height:${SIZE}px}
    </style>${svg}`;

  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    useContentSize: true,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false }
  });

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 400));

  const shot = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE });
  if (shot.isEmpty()) throw new Error('capturePage returned an empty image');

  // On a HiDPI display capturePage returns 2x pixels; normalise to SIZE.
  const master = shot.getSize().width === SIZE
    ? shot
    : shot.resize({ width: SIZE, height: SIZE, quality: 'best' });

  fs.writeFileSync(pngPath, master.toPNG());
  console.log(`build/icon.png — ${SIZE}x${SIZE}`);

  fs.mkdirSync(iconsDir, { recursive: true });
  for (const size of LINUX_SIZES) {
    const scaled = size === SIZE ? master : master.resize({ width: size, height: size, quality: 'best' });
    fs.writeFileSync(path.join(iconsDir, `${size}x${size}.png`), scaled.toPNG());
  }
  console.log(`build/icons/ — ${LINUX_SIZES.join(', ')}`);

  win.destroy();
  app.exit(0);
}).catch((err) => {
  console.error('icon render failed:', err);
  app.exit(1);
});
