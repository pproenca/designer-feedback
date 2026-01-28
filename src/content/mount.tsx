import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';

import contentStyles from './styles.scss?inline';
import toolbarStyles from '@/components/FeedbackToolbar/styles.module.scss?inline';
import popupStyles from '@/components/AnnotationPopup/styles.module.scss?inline';
import exportStyles from '@/components/ExportModal/styles.module.scss?inline';

const CONTAINER_ID = 'designer-feedback-root';
const GLOBAL_STYLE_ID = 'designer-feedback-global-style';
const sourceSansUrl = new URL(
  '../assets/fonts/source-sans-3/SourceSans3-Variable.woff2',
  import.meta.url
).toString();
const fontFaces = `@font-face {
  font-family: "Source Sans 3";
  font-style: normal;
  font-weight: 200 900;
  font-display: swap;
  src: url("${sourceSansUrl}") format("woff2");
}`;

let root: ReactDOM.Root | null = null;
let container: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
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

export async function mountUI(): Promise<ShadowRoot> {
  if (container && shadowRoot) {
    return shadowRoot;
  }

  await waitForDomReady();
  ensureGlobalStyles();

  const existing = document.getElementById(CONTAINER_ID);
  if (existing && existing.shadowRoot) {
    container = existing;
    shadowRoot = existing.shadowRoot;
    return shadowRoot;
  }

  container = document.createElement('div');
  container.id = CONTAINER_ID;
  shadowRoot = container.attachShadow({ mode: 'open' });

  const styleElement = document.createElement('style');
  styleElement.textContent = [
    fontFaces,
    contentStyles,
    toolbarStyles,
    popupStyles,
    exportStyles,
  ].join('\n');
  shadowRoot.appendChild(styleElement);

  const appRoot = document.createElement('div');
  appRoot.id = 'app';
  shadowRoot.appendChild(appRoot);

  document.body.appendChild(container);

  root = ReactDOM.createRoot(appRoot);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App shadowRoot={shadowRoot} />
      </ErrorBoundary>
    </React.StrictMode>
  );

  return shadowRoot;
}

export function unmountUI(): void {
  root?.unmount();
  container?.remove();
  globalStyleElement?.remove();
  root = null;
  container = null;
  shadowRoot = null;
  globalStyleElement = null;
}
