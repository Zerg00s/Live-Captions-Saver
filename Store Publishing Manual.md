# Publishing to the Chrome Web Store and Firefox Add-ons

One source folder (`teams-captions-saver/`) feeds both stores. The build script makes a separate package for each store, so a release is one version bump, one build, and two uploads.

## How the two builds differ

| | Chrome (also Edge and Brave) | Firefox (also Zen and other Firefox forks) |
|---|---|---|
| Built from | `teams-captions-saver/` | `teams-captions-saver/` |
| Manifest | Copied unchanged | `background.scripts` instead of `background.service_worker`, plus a `browser_specific_settings.gecko` block |
| Output folder | `dist/chrome/` | `dist/firefox/` |
| Upload file | `dist/chrome-<version>.zip` | `dist/firefox-<version>.zip` |
| Store | [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole) | [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/) |

The Chrome package is byte-for-byte the source folder, so Chrome users get exactly what you test with "Load unpacked". The Firefox differences live only in `firefoxManifest()` in `build.js`. Never edit files inside `dist/`, because the next build overwrites them.

The JavaScript is shared. Where the browsers behave differently, the code checks for the feature at runtime (for example `importScripts` and `URL.createObjectURL` in `service_worker.js`), so there is no per-browser copy of any script.

## Release steps

1. Make and test your changes in `teams-captions-saver/`.
2. Bump `"version"` in `teams-captions-saver/manifest.json`. Both stores reject an upload whose version is not higher than the published one.
3. Build both packages from the repository root:

   ```
   node build.js
   ```

4. Test the Firefox build. In Firefox open `about:debugging`, choose This Firefox, then Load Temporary Add-on, and pick `dist/firefox/manifest.json`. Reload the Teams tab and check capture, save, copy, and the viewer.
5. Optionally lint the Firefox build, which runs the same checks as the Mozilla review:

   ```
   npx web-ext lint -s dist/firefox
   ```

6. Upload to Chrome:
   1. Open the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole) and click the extension.
   2. Go to Package, then Upload new package.
   3. Choose `dist/chrome-<version>.zip` and click Upload.
   4. Submit for review.
7. Upload to Firefox:
   1. Open the [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/addons) and click the add-on.
   2. Click Upload New Version.
   3. Choose `dist/firefox-<version>.zip`.
   4. When asked whether you need to submit source code, answer No. The package is not minified or bundled, so reviewers can read it as is.
   5. Add release notes and submit.

## Things that must not change

The Firefox add-on ID `teams-captions-saver@spdenis.com` is set in `build.js`. Firefox uses it to identify the add-on and to key each user's synced settings. Changing it after publishing turns the add-on into a different one, and existing users stop getting updates.

The Chrome extension ID comes from the Chrome Web Store listing and is not in the manifest, so nothing in this repository can change it.

## When to edit build.js

Only when Firefox needs something Chrome must not get (or the other way around) in the manifest, for example a new background script. Add it in `firefoxManifest()` and keep `teams-captions-saver/manifest.json` as the Chrome version. A new background script must be added in two places: `importScripts()` at the top of `service_worker.js` for Chrome, and the `scripts` list in `firefoxManifest()` for Firefox.
