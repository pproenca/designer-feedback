import React from 'react';
import ReactDOM from 'react-dom/client';
import { LazyMotion, domAnimation } from 'framer-motion';
import { createShadowRootUi, type ContentScriptContext } from '#imports';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { BaseUIProvider } from '@/components/BaseUIProvider';
import './style.css';

const GLOBAL_STYLE_ID = 'designer-feedback-global-style';

let globalStyleElement: HTMLStyleElement | null = null;

/**
 * Cleanup handle returned from onMount for structured cleanup in onRemove
 */
export interface MountCleanupHandle {
  /** React root for unmounting */
  root: ReactDOM.Root;
  /** App container element for DOM cleanup */
  appRoot: HTMLDivElement;
  /** Portal container for Base UI components */
  portalContainer: HTMLDivElement;
}

function waitForDomReady(): Promise<void> {
  if (document.readyState !== 'loading') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
  });
}

function ensureGlobalStyles(): void {
  if (document.getElementById(GLOBAL_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = GLOBAL_STYLE_ID;
  style.textContent = `
    body.designer-feedback-add-mode,
    body.designer-feedback-add-mode * {
      cursor: crosshair !important;
    }
  `;
  document.head.appendChild(style);
  globalStyleElement = style;
}

export async function mountUI(ctx: ContentScriptContext) {
  await waitForDomReady();
  ensureGlobalStyles();

  // Use open shadow DOM in E2E tests so Playwright can access elements.
  // In production, use closed mode to prevent page scripts from accessing extension internals.
  // Note: isolateEvents is intentionally NOT set - it blocks keyboard events (Escape, Enter).
  const isE2E = import.meta.env.VITE_DF_E2E === '1';

  const ui = await createShadowRootUi(ctx, {
    name: 'designer-feedback-root',
    position: 'inline',
    anchor: 'body',
    mode: isE2E ? 'open' : 'closed',
    onMount: (container, shadow): MountCleanupHandle => {
      const appRoot = document.createElement('div');
      appRoot.id = 'app';
      container.appendChild(appRoot);

      // Create portal container for Base UI components (tooltips, dialogs, etc.)
      const portalContainer = document.createElement('div');
      portalContainer.id = 'base-ui-portal';
      container.appendChild(portalContainer);

      const root = ReactDOM.createRoot(appRoot);
      root.render(
        <React.StrictMode>
          <ErrorBoundary>
            <BaseUIProvider portalContainer={portalContainer}>
              <LazyMotion features={domAnimation}>
                <App shadowRoot={shadow} />
              </LazyMotion>
            </BaseUIProvider>
          </ErrorBoundary>
        </React.StrictMode>
      );
      return { root, appRoot, portalContainer };
    },
    onRemove: (handle) => {
      if (handle) {
        handle.root.unmount();
        handle.appRoot.remove();
        handle.portalContainer.remove();
      }
      globalStyleElement?.remove();
      globalStyleElement = null;
    },
  });

  ui.mount();
  return ui;
}
