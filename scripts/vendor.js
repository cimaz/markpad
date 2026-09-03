'use strict';

/* Copies browser-side libs out of node_modules into src/vendor so the
   renderer can load them under a strict `script-src 'self'` CSP. */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'src', 'vendor');

const files = [
  ['dompurify/dist/purify.min.js', 'purify.min.js']
];

fs.mkdirSync(outDir, { recursive: true });

for (const [from, to] of files) {
  const src = path.join(root, 'node_modules', from);
  const dest = path.join(outDir, to);
  try {
    fs.copyFileSync(src, dest);
    console.log('vendored', to);
  } catch (err) {
    console.warn('could not vendor', from, '-', err.message);
  }
}
