# Designer Feedback

Annotate live webpages and export actionable feedback for implementation.

## Browser support

- Chrome MV3 (`.output/chrome-mv3`)
- Firefox MV3 (`.output/firefox-mv3`)

## Features

- On-page annotation toolbar with category tagging and marker management
- Element-targeted comments with visual highlight and per-page badge counts
- Export flows:
  - Download snapshot image
  - Copy Markdown notes to clipboard
- Context menu shortcuts:
  - Open Feedback Toolbar
  - Export Feedback Snapshot

## Data and privacy

- Annotation data is stored locally and keyed by page URL.
- Settings are stored in sync storage (currently light/dark preference and legacy enable-state migration key).
- Pending snapshot resume state is stored session-first with local fallback for reliability.
- Annotation retention is 7 days.
- No analytics or remote backend; data leaves the extension only when you export/share it.

Full policy: `docs/privacy.html`.

## Permissions

Production builds request:

- `storage`
- `downloads`
- `activeTab`
- `scripting`
- `contextMenus`
- `offscreen` (Chromium builds only)

Notes:

- No persistent broad `host_permissions` in production.
- `tabs` is test-only and only included in E2E builds.
- Snapshot capture is runtime-gated by `activeTab`; if access expires, invoking the extension action re-establishes access and resumes export.

## Install from source

1. `npm install`
2. `npm run build`

Load unpacked builds:

- Chrome: `chrome://extensions` -> Developer mode -> Load unpacked -> select `.output/chrome-mv3`
- Firefox: `about:debugging#/runtime/this-firefox` -> Load Temporary Add-on -> select `.output/firefox-mv3/manifest.json`

## Development

Key scripts:

- `npm run dev` - WXT dev server
- `npm run build` - production builds for Chrome MV3 + Firefox MV3
- `npm run zip` - package Chrome MV3
- `npm run zip:firefox` - package Firefox MV3
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e:chrome`
- `npm run test:e2e:firefox`
- `npm run verify:manifests`
- `npm run check:bundle-size`

## Project structure

- `entrypoints/` - WXT entrypoints (`background.ts`, `content/`, `offscreen/`, `test-activate/`)
- `components/` - shared React UI
- `hooks/`, `stores/`, `utils/`, `shared/`, `types/` - app logic and typed utilities
- `tests/` - Playwright E2E specs and fixtures
- `test/` - Vitest setup
- `docs/` - project docs and privacy policy

## License

MIT. See `LICENSE`.
