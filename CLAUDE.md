# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Designer Feedback is a Chrome extension (Manifest V3) for annotating webpages with visual feedback markers and notes. Annotations are stored locally in IndexedDB and can be exported as images or markdown reports.

## Development Commands

```bash
npm run dev          # Start WXT dev server with HMR
npm run build        # Production build
npm run typecheck    # TypeScript checking only
npm run lint         # ESLint (zero warnings enforced)
npm run lint:fix     # Auto-fix ESLint violations
npm run test         # Run Vitest unit tests
npm run test:e2e     # Build with E2E flag + run Playwright tests
npm run test:e2e:firefox # Firefox E2E smoke test via Selenium + geckodriver
npm run zip          # Create ZIP for Chrome Web Store
```

**Running single tests:**
```bash
npx vitest run path/to/file.spec.ts           # Single unit test file
npx vitest run -t "test name pattern"         # By test name
npx playwright test tests/extension.spec.ts   # Single E2E test (requires build first)
```

## Architecture

```
designer-feedback/
├── entrypoints/
│   ├── background.ts      # Service worker - icon click, capture, message routing
│   └── content/           # Content script - toolbar, markers, element selection
│       ├── index.ts       # Entry point, message handlers, injection guard
│       ├── App.tsx        # React app root
│       └── mount.tsx      # Shadow DOM mounting with WXT createShadowRootUi
├── components/            # React components (AnnotationPopup, ExportModal, FeedbackToolbar)
├── stores/                # Zustand stores (annotations, toolbar state)
├── utils/                 # Utilities (storage, export, messaging, screenshot)
│   ├── schemas.ts         # Zod schemas for message validation
│   └── background-helpers.ts  # Service worker utilities
├── shared/                # Shared constants (settings, categories)
├── types/                 # TypeScript definitions
├── hooks/                 # React hooks
├── test/                  # Vitest setup (fakeBrowser globals)
└── tests/                 # Playwright E2E tests
```

**Key architectural patterns:**
- **1-click activation**: Icon click → `scripting.executeScript()` injects content script → toolbar shows
- **Shadow DOM isolation**: UI renders in closed shadow root (open in E2E for Playwright access)
- **Same-origin persistence**: Tab tracking via `browser.storage.session` re-injects on navigation
- **Message validation**: Zod schemas in `utils/schemas.ts` validate all cross-context messages
- **State management**: Zustand stores with event-style action naming (e.g., `annotationCreated`)

## Tech Stack

- **Build**: WXT (Web Extension Tools) with auto-manifest generation
- **UI**: React 19 + TypeScript + Tailwind CSS v4 + Base UI + Framer Motion
- **State**: Zustand with subscription-based side effects (badge updates)
- **Testing**: Vitest (unit) with WXT fakeBrowser, Playwright (E2E, Chromium only)
- **Validation**: Zod for message schemas

## Code Conventions

- **Commits**: Conventional commits enforced via lefthook + commitlint
- **Types**: Strict TypeScript, no unused variables/params
- **CSS**: Tailwind utility classes, animations via Framer Motion
- **Path alias**: `@/*` maps to project root
- **Storage**: IndexedDB for annotations (URL-keyed), browser.storage.sync for settings

## Testing

- Unit tests: `*.spec.ts` alongside source files, uses `wxt/testing/fake-browser`
- E2E tests: `tests/*.spec.ts`, sequential workers, 2 retries in CI
- E2E build flag: `VITE_DF_E2E=1` switches shadow DOM to open mode
- E2E snapshot capture uses a placeholder image when `VITE_DF_E2E=1` to avoid activeTab user-gesture limits
- Playwright extension testing is Chromium-only; Firefox project is configured but skipped
- Firefox E2E automation uses `scripts/firefox-e2e.mjs` (Selenium + geckodriver) and loads the Firefox zip
- Test setup configures global `browser` and `chrome` objects from fakeBrowser

## Key Types

- `Annotation` - Marker with coordinates, comment, category, element metadata, optional `isFixed` for viewport-relative positioning
- `FeedbackCategory` - 'bug' | 'suggestion' | 'question' | 'accessibility'
- `Message` - Discriminated union of all message types (validated via Zod)
- `Settings` - Extension config (enabled, lightMode)
