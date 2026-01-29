# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Designer Feedback is a Chrome extension (Manifest V3) for annotating webpages with visual feedback markers and notes. Annotations are stored locally in IndexedDB and can be exported as images or markdown reports.

## Development Commands

```bash
npm run dev          # Start WXT dev server with HMR
npm run build        # TypeCheck + production build
npm run typecheck    # TypeScript checking only
npm run lint         # ESLint (zero warnings enforced)
npm run lint:fix     # Auto-fix ESLint violations
npm run test         # Run Vitest unit tests
npm run test:e2e     # Run Playwright E2E tests
npm run zip          # Create ZIP for Chrome Web Store
```

## Architecture

```
designer-feedback/
├── entrypoints/
│   ├── background.ts      # Service worker - badge updates, message handling
│   └── content/           # Content script - toolbar, markers, element selection
│       ├── index.ts       # Content script entry point
│       ├── App.tsx        # React app root
│       └── mount.tsx      # Shadow DOM mounting
├── components/            # React components (AnnotationPopup, ExportModal, FeedbackToolbar)
├── utils/                 # Utilities (storage, export, messaging, permissions, screenshot)
├── shared/                # Shared constants (settings, categories)
├── types/                 # TypeScript definitions
├── hooks/                 # React hooks
├── test/                  # Test setup and utilities
└── tests/                 # Playwright E2E tests
```

**Key architectural boundaries:**
- **Content script** injects into pages, manages annotations and UI overlay (Shadow DOM)
- **Service worker** handles background tasks (badge, cross-context messaging)
- Communication between contexts uses typed messages via `utils/messaging.ts`

## Tech Stack

- **Build**: WXT (Web Extension Tools) with auto-manifest generation
- **UI**: React 19 + TypeScript + Tailwind CSS v4 + Framer Motion
- **Testing**: Vitest (unit), Playwright (E2E, Chromium only)
- **Export**: html2canvas for screenshots, JSZip for packaging
- **Browser API**: WXT's `browser.*` API (Promise-based WebExtension polyfill)

## Code Conventions

- **Commits**: Conventional commits enforced (`feat:`, `fix:`, `chore:`, etc.)
- **Types**: Strict TypeScript, no unused variables/params
- **CSS**: Tailwind utility classes, animations via Framer Motion
- **Path alias**: `@/*` maps to project root
- **Storage**: browser.storage.local for annotations (URL-keyed), browser.storage.sync for settings

## Testing

- Unit tests: `*.spec.ts` or `*.test.tsx` alongside source files
- E2E tests: `tests/*.spec.ts` using Playwright
- E2E runs with 1 worker (sequential), 2 retries in CI
- Test setup in `test/setup.ts`
- Build output for E2E: `.output/chrome-mv3/`

## Key Types (types/index.ts)

- `Annotation` - Marker with coordinates, comment, category, element metadata
- `FeedbackCategory` - 'bug' | 'suggestion' | 'question' | 'accessibility'
- `Settings` - Extension config (enabled, lightMode, siteListMode, siteList)
- `MessageType` - Typed enum for cross-context messaging
