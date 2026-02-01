# Repository Guidelines

## Project Structure & Module Organization
- `entrypoints/` houses WXT entrypoints: `background.ts` (service worker), `content/` (content script + UI), `test-activate/`.
- `components/` contains shared React UI components (toolbar, panels, modals).
- `hooks/`, `stores/`, `utils/`, `shared/`, and `types/` contain hooks, Zustand stores, utilities, shared constants, and TS types.
- `tests/` contains Playwright end-to-end specs and fixtures.
- `test/` holds Vitest setup (fakeBrowser globals).
- `docs/` contains policy and documentation assets (see `docs/privacy.html`).
- `assets/` and `public/` hold static assets and icons.
- `scripts/` includes build and asset helpers.
- `.output/` and `.wxt/` are generated build/dev outputs; don’t edit by hand.

## Build, Test, and Development Commands
- `npm run dev` — start WXT dev server with HMR.
- `npm run build` — build the production extension.
- `npm run zip` — create a zip for distribution.
- `npm run test` — run Vitest unit tests.
- `npm run test:coverage` — run Vitest with coverage.
- `npm run test:e2e` — build with E2E flag and run Playwright tests.
- `npm run lint` — run ESLint checks (zero warnings).
- `npm run typecheck` — TypeScript type checks without emitting.

## Coding Style & Naming Conventions
- TypeScript + React + WXT. Use 2-space indentation and keep semicolons consistent with existing files.
- Styling uses Tailwind CSS v4 and `entrypoints/content/style.css` for theme tokens and base layers.
- Prefer `@/` path alias (root) for shared imports.
- Co-locate unit tests with source as `*.spec.ts`.
- ESLint is the source of truth for style; fix issues before pushing.

## Testing Guidelines
- Vitest is used for unit tests; Playwright covers extension behavior.
- Use `tests/fixtures.ts` utilities for e2e setup.
- Keep tests deterministic; add or update tests when behavior changes.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits enforced by commitlint: `feat:`, `fix:`, `docs:`, `chore:`, `test:`, etc. Keep subjects under 100 characters (example: `feat: add draggable toolbar`).
- `lefthook` runs pre-push checks: typecheck, lint, test, build.
- PRs should follow `.github/PULL_REQUEST_TEMPLATE.md`: include a concise description, type of change, related issues, checklist, and screenshots when UI changes.

## Security & Configuration Notes
- Extension permissions and manifest configuration live in `wxt.config.ts`.
- Privacy policy updates belong in `docs/privacy.html`.
