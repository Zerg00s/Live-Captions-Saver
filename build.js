// Builds browser-specific copies of the extension:
//   dist/chrome/   - identical to teams-captions-saver/ (what the Chrome Web Store gets)
//   dist/firefox/  - same files, manifest adjusted for Firefox (and Zen and other Firefox forks)
// Usage: node build.js
// Also writes dist/<browser>-<version>.zip, ready to upload to each store.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC = path.join(__dirname, 'teams-captions-saver');
const DIST = path.join(__dirname, 'dist');

// Must never change once published on addons.mozilla.org - it identifies the add-on
// and keys the user's storage.sync data.
const GECKO_ID = 'teams-captions-saver@spdenis.com';

function copyExtension(target) {
    fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(SRC, target, {
        recursive: true,
        filter: src => !path.basename(src).startsWith('.')
    });
}

function firefoxManifest(manifest) {
    const ff = structuredClone(manifest);
    // Firefox has no extension service workers; it runs background scripts as an event page.
    ff.background = { scripts: ['idbStorage.js', 'service_worker.js'] };
    ff.browser_specific_settings = {
        gecko: {
            id: GECKO_ID,
            // 140 is the first version that understands data_collection_permissions.
            strict_min_version: '140.0',
            data_collection_permissions: { required: ['none'] }
        }
    };
    return ff;
}

// Zips the folder contents (manifest.json at the zip root, as both stores require).
// Uses Python's zipfile module, which is present in WSL; Windows `tar` is the fallback.
function zip(dir, name) {
    const zipPath = path.join(DIST, name);
    fs.rmSync(zipPath, { force: true });
    const py = [
        'import os, sys, zipfile',
        'src, out = sys.argv[1], sys.argv[2]',
        'with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:',
        '    for root, dirs, files in os.walk(src):',
        '        dirs.sort()',
        '        for f in sorted(files):',
        '            p = os.path.join(root, f)',
        '            z.write(p, os.path.relpath(p, src).replace(os.sep, "/"))'
    ].join('\n');
    for (const cmd of ['python3', 'python']) {
        try {
            execSync(`${cmd} -I -c '${py}' "${dir}" "${zipPath}"`, { stdio: 'ignore' });
            return zipPath;
        } catch { /* try next */ }
    }
    try {
        execSync(`tar -a -c -f "${zipPath}" -C "${dir}" .`, { stdio: 'ignore' });
        return zipPath;
    } catch {
        return null;
    }
}

const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
fs.mkdirSync(DIST, { recursive: true });

const chromeDir = path.join(DIST, 'chrome');
copyExtension(chromeDir);

const firefoxDir = path.join(DIST, 'firefox');
copyExtension(firefoxDir);
fs.writeFileSync(
    path.join(firefoxDir, 'manifest.json'),
    JSON.stringify(firefoxManifest(manifest), null, 2) + '\n'
);

console.log(`Built version ${manifest.version}:`);
for (const [browser, dir] of [['chrome', chromeDir], ['firefox', firefoxDir]]) {
    const zipped = zip(dir, `${browser}-${manifest.version}.zip`);
    console.log(`  ${browser}: ${path.relative(__dirname, dir)}${zipped ? ` + ${path.relative(__dirname, zipped)}` : ''}`);
}
