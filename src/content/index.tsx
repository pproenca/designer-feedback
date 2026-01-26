import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

// Import all styles as inline strings for Shadow DOM injection
import contentStyles from './styles.scss?inline';
import toolbarStyles from '@/components/FeedbackToolbar/styles.module.scss?inline';
import popupStyles from '@/components/AnnotationPopup/styles.module.scss?inline';
import categoryStyles from '@/components/CategorySelector/styles.module.scss?inline';
import exportStyles from '@/components/ExportModal/styles.module.scss?inline';

// =============================================================================
// Shadow DOM Injection
// =============================================================================

const CONTAINER_ID = 'designer-feedback-root';

function injectContentScript() {
  // Prevent double injection
  if (document.getElementById(CONTAINER_ID)) {
    return;
  }

  // Create container element
  const container = document.createElement('div');
  container.id = CONTAINER_ID;

  // Attach shadow DOM for style isolation
  const shadowRoot = container.attachShadow({ mode: 'open' });

  // Inject all styles into shadow DOM
  const styleElement = document.createElement('style');
  styleElement.textContent = [
    contentStyles,
    toolbarStyles,
    popupStyles,
    categoryStyles,
    exportStyles,
  ].join('\n');
  shadowRoot.appendChild(styleElement);

  // Create React mount point
  const appRoot = document.createElement('div');
  appRoot.id = 'app';
  shadowRoot.appendChild(appRoot);

  // Append to body
  document.body.appendChild(container);

  // Mount React app
  ReactDOM.createRoot(appRoot).render(
    <React.StrictMode>
      <App shadowRoot={shadowRoot} />
    </React.StrictMode>
  );
}

// Inject when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectContentScript);
} else {
  injectContentScript();
}
