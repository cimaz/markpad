'use strict';

/* Fills Casks/markpad.rb with the version from package.json and the SHA-256 of
   the two macOS DMGs in distro/. Run after `npm run dist:mac`:

     npm run dist:mac
     npm run cask:sha
     git commit -am "Cask: v<version>"

   Then create the GitHub release and upload the DMGs (their names must match
   the `url` lines in the cask).                                             */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const { version } = require(path.join(root, 'package.json'));
const caskPath = path.join(root, 'Casks', 'markpad.rb');

function sha256(file) {
  const full = path.join(root, 'distro', file);
  if (!fs.existsSync(full)) {
    console.error(`missing: distro/${file} — run "npm run dist:mac" first`);
    process.exit(1);
  }
  return crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
}

const arm = sha256(`Markpad-${version}-mac-arm64.dmg`);
const x64 = sha256(`Markpad-${version}-mac-x64.dmg`);

let cask = fs.readFileSync(caskPath, 'utf8');
cask = cask.replace(/^(\s*)version "[^"]*"/m, `$1version "${version}"`);

// Replace the sha256 inside each on_* block in order (arm first, then intel).
let seen = 0;
cask = cask.replace(/^(\s*)sha256 "[0-9a-f]{64}"/gm, (m, indent) => {
  seen += 1;
  return `${indent}sha256 "${seen === 1 ? arm : x64}"`;
});
if (seen !== 2) {
  console.error(`expected 2 sha256 lines in the cask, found ${seen}`);
  process.exit(1);
}

fs.writeFileSync(caskPath, cask);
console.log(`Casks/markpad.rb updated for v${version}`);
console.log(`  arm64  ${arm}`);
console.log(`  x64    ${x64}`);
