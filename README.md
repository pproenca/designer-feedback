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
- Export as interactive HTML, a full-page snapshot image, or copy a markdown report
- Site access controls with allowlist and blocklist modes
- Local-only storage with a per-page badge count

## how it works

1. Click the toolbar button and choose a category.
2. Click an element on the page and write your note.
3. Review markers directly on the page.
4. Export when you are ready to share.

## exports

- Interactive HTML: a single file with a full-page screenshot and hoverable markers.
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
- `tabs` to read the current tab URL and title for export metadata.
- `activeTab` + `scripting` to inject the toolbar on the current page when you use the extension.
- `optional_host_permissions` for `http` and `https`, requested only when you allow specific sites or all sites.

## installation

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
