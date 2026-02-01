# Designer Feedback

Annotate any webpage and export visual feedback that developers can act on.

Designer Feedback adds a small toolbar to the current page so you can drop markers, write notes, and export a shareable artifact.

## problem statement

Design feedback often arrives as a mix of screenshots plus vague comments in chat. The person implementing has to guess which element was meant, where it lives, and how to reproduce the issue. That guesswork slows reviews and causes rework.

## the dream state

Open the page, click what you mean, and leave a clear note tied to the exact element. When it is time to share, export a single file that anyone can open and understand without back-and-forth.

## features

- On-page toolbar with add mode and hover highlight to pick the exact element
- Categories for bug, suggestion, question, and accessibility feedback
- Numbered markers with quick view and delete or clear-all controls
- Export as a full-page snapshot image or copy a markdown report
- Site access controls with allowlist and blocklist modes
- Local-only storage with a per-page badge count

## how it works

1. Click the toolbar button and choose a category.
2. Click an element on the page and write your note.
3. Review markers directly on the page.
4. Export when you are ready to share.

## exports

- Snapshot image: a full-page image with highlights and a sidebar list.
- Markdown to clipboard: a concise report you can paste into an issue or PR.

## privacy and data

- Annotations are stored locally in IndexedDB and keyed to the page URL.
- Settings (enabled state, site list) are stored in chrome.storage.sync.
- Old annotations are cleaned up after 30 days.
- No servers or analytics. Data only leaves the extension when you export and share it.

See `docs/privacy.html` for the full policy.

## permissions

- `storage` to save annotations and settings locally.
- `tabs` to capture the visible tab during snapshot exports.
- `activeTab` and `scripting` to inject the toolbar and capture screenshots on demand.
- `downloads` to save snapshot exports to your device.
- `contextMenus` to expose a right-click “Export feedback snapshot” shortcut.

## installation

### battle-tested install outside the web store

The most common pattern used by large open-source extensions is:

1. **Download a prebuilt zip from GitHub Releases.**
2. **Unzip it and load it unpacked in Chrome.**
3. **Manually update by downloading the next release.**

This repo supports that flow (plus build-from-source) so you can install without the web store.

### install from release (no store)

1. Run the installer:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/pproenca/designer-feedback/master/scripts/install.sh | bash
   ```
2. Open Chrome and go to `chrome://extensions`.
3. Enable Developer mode.
4. Click "Load unpacked" and select `~/.designer-feedback`.

To install from your own fork or a direct asset URL:

```bash
REPO=you/designer-feedback curl -fsSL https://raw.githubusercontent.com/pproenca/designer-feedback/master/scripts/install.sh | bash
curl -fsSL https://raw.githubusercontent.com/pproenca/designer-feedback/master/scripts/install.sh | bash -s -- --zip-url https://example.com/designer-feedback.zip
```

### build from source

1. `npm install`
2. `npm run build`
3. Open Chrome and go to `chrome://extensions`.
4. Enable Developer mode.
5. Click "Load unpacked" and select `dist`.

For local development with live rebuilds:

1. `npm run dev`
2. Load `dist` as above.

## development scripts

- `npm run dev` starts the Vite dev build.
- `npm run build` builds the production extension.
- `npm run pack` builds and creates a zip in `dist`.
- `npm run test` runs unit tests.
- `npm run test:e2e` runs Playwright tests.

## project structure

- `src/content` content script that injects the toolbar and markers
- `src/popup` extension popup UI and site access settings
- `src/background` service worker for badge updates
- `src/utils` storage, export, and screenshot helpers
- `docs/privacy.html` privacy policy

## contributing

If you are working in this repo, keep changes small and focused. Add or update tests when behavior changes.

## license

MIT License. See `LICENSE`.
