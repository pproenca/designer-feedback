# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Designer Feedback is a Chrome extension (Manifest V3) for annotating webpages with visual feedback markers and notes. Annotations are stored locally in IndexedDB and can be exported as images or markdown reports.

## Development Commands

```bash
npm run dev          # Start Vite dev server with HMR
npm run build        # TypeCheck + production build
npm run typecheck    # TypeScript checking only
npm run lint         # ESLint (zero warnings enforced)
npm run lint:fix     # Auto-fix ESLint violations
npm run test         # Run Vitest unit tests
npm run test:e2e     # Run Playwright E2E tests
npm run release      # Bump version, sync manifest, create ZIP
npm run build:analyze # Build and open bundle visualizer
```

## Architecture

```
src/
├── background/      # Service worker - badge updates, message handling
├── content/         # Content script - toolbar, markers, element selection
├── popup/           # Extension popup - settings UI, site access controls
├── components/      # React components (AnnotationPopup, ExportModal, FeedbackToolbar)
├── utils/           # Utilities (storage, export, messaging, permissions, screenshot)
├── shared/          # Shared constants (settings, categories)
└── types/           # TypeScript definitions
```

**Key architectural boundaries:**
- **Content script** injects into pages, manages annotations and UI overlay
- **Service worker** handles background tasks (badge, cross-context messaging)
- **Popup** manages extension-level settings (allowlist/blocklist, preferences)
- Communication between contexts uses typed messages via `src/utils/messaging.ts`

## Tech Stack

- **Build**: Vite + @crxjs/vite-plugin
- **UI**: React 18 + TypeScript + SCSS modules (camelCase convention)
- **Testing**: Vitest (unit), Playwright (E2E, Chromium only)
- **Export**: html2canvas for screenshots, JSZip for packaging
- **Hooks**: Lefthook runs typecheck → lint → test → build on pre-push

## Code Conventions

- **Commits**: Conventional commits enforced (`feat:`, `fix:`, `chore:`, etc.)
- **Types**: Strict TypeScript, no unused variables/params
- **CSS**: SCSS modules with camelCase class names
- **Path alias**: `@/*` maps to `src/*`
- **Storage**: IndexedDB for annotations (URL-keyed), chrome.storage.sync for settings

## Testing

- Unit tests: `*.spec.ts` or `*.test.tsx` alongside source files
- E2E tests: `tests/*.spec.ts` using Playwright
- E2E runs with 1 worker (sequential), 2 retries in CI
- Test setup in `src/test/setup.ts`

## Key Types (src/types/index.ts)

- `Annotation` - Marker with coordinates, comment, category, element metadata
- `FeedbackCategory` - 'bug' | 'suggestion' | 'question' | 'accessibility'
- `Settings` - Extension config (enabled, lightMode, siteListMode, siteList)
- `MessageType` - Typed enum for cross-context messaging
