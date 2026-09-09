'use strict';

/* Ad-hoc code signing for the macOS build.
 *
 * With no paid Apple Developer account, electron-builder skips signing
 * entirely ("no valid identity"). That leaves the x64 app completely
 * unsigned and the arm64 app carrying only the automatic linker signature
 * on its main executable — the bundle, its frameworks and its helper apps
 * are unsigned, which trips "app is damaged" on some setups.
 *
 * Signing the whole bundle with the ad-hoc identity ("-") fixes that: the
 * app launches on Apple Silicon and reads as intact. It is still NOT
 * notarized, so Gatekeeper quarantines the download and the user clears it
 * once (right-click > Open, the Homebrew cask with --no-quarantine, or
 * `xattr -dr com.apple.quarantine`). See the README.
 */

const path = require('path');
const { execFileSync } = require('child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  // Sign inside-out: helpers and frameworks first, the outer bundle last.
  // `--deep` handles the nesting; `--force` replaces the linker signature.
  console.log(`  • ad-hoc signing   ${path.relative(context.packager.projectDir, appPath)}`);
  execFileSync(
    'codesign',
    ['--force', '--deep', '--sign', '-', '--identifier', context.packager.appInfo.id, appPath],
    { stdio: 'inherit' }
  );

  // Fail the build if the signature did not take, rather than shipping a
  // silently-unsigned app.
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' });
};
