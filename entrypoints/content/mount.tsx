import React from 'react';
import ReactDOM from 'react-dom/client';
import { createShadowRootUi, type ContentScriptContext } from 'wxt/client';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import './style.css';

const GLOBAL_STYLE_ID = 'designer-feedback-global-style';

let globalStyleElement: HTMLStyleElement | null = null;

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

  const isE2E = import.meta.env.VITE_DF_E2E === '1';
  const shadowMode = isE2E ? 'open' : 'closed';

  const ui = await createShadowRootUi(ctx, {
    name: 'designer-feedback-root',
    position: 'inline',
    anchor: 'body',
    mode: shadowMode,
    isolateEvents: true,
    onMount: (container, shadow) => {
      const appRoot = document.createElement('div');
      appRoot.id = 'app';
      container.appendChild(appRoot);

      const root = ReactDOM.createRoot(appRoot);
      root.render(
        <React.StrictMode>
          <ErrorBoundary>
            <App shadowRoot={shadow} />
          </ErrorBoundary>
        </React.StrictMode>
      );
      return root;
    },
    onRemove: (root) => {
      root?.unmount();
      globalStyleElement?.remove();
      globalStyleElement = null;
    },
  });

  ui.mount();
  return ui;
}
