# Repository Guidelines

## Project Structure & Module Organization
- `src/` houses the extension source. Key areas: `src/content` (content script + injected UI), `src/background` (service worker), `src/popup`/`src/components` (popup and shared UI), `src/utils` and `src/shared` (helpers and shared types).
- `tests/` contains Playwright end-to-end specs. Unit tests live alongside source as `*.spec.ts`.
- `docs/` holds policy and documentation assets (see `docs/privacy.html`).
- `scripts/` includes build and asset generators.
- `dist/` is generated build output; don’t edit by hand.
- Root files like `manifest.json`, `vite.config.ts`, and `tsconfig.json` define extension and build config.

## Build, Test, and Development Commands
- `npm run dev` — start Vite in watch mode for extension development.
- `npm run build` — run `tsc` then produce the production build in `dist/`.
- `npm run pack` — build and zip the extension for sharing (`dist/designer-feedback.zip`).
- `npm run test` — run Vitest unit tests.
- `npm run test:e2e` — run Playwright tests in `tests/`.
- `npm run lint` / `npm run lint:fix` — run ESLint checks or auto-fix.
- `npm run typecheck` — TypeScript type checks without emitting.

## Coding Style & Naming Conventions
- TypeScript + React + Vite. Use 2-space indentation and keep semicolons consistent with existing files.
- UI styles use SCSS modules (e.g., `styles.module.scss`). Global styles live in `src/content/styles.scss`.
- Co-locate tests with source as `*.spec.ts` (e.g., `src/utils/storage.spec.ts`).
- ESLint is the source of truth for style; fix issues before pushing.

## Testing Guidelines
- Vitest is used for unit tests; Playwright covers extension behavior.
- Keep tests deterministic; prefer utilities in `tests/fixtures.ts` for e2e setup.
- Add or update tests when behavior changes.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits enforced by commitlint: `feat:`, `fix:`, `docs:`, `chore:`, `test:`, etc. Keep subjects under 100 characters (example: `feat: add draggable toolbar`).
- `lefthook` runs pre-push checks: typecheck, lint, test, build.
- PRs should follow `.github/PULL_REQUEST_TEMPLATE.md`: include a concise description, type of change, related issues, checklist, and screenshots when UI changes.

## Security & Configuration Notes
- Extension permissions and entry points are defined in `manifest.json`.
- Privacy policy updates belong in `docs/privacy.html`.
