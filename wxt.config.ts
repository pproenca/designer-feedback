import {defineConfig} from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  srcDir: '.',
  outDir: '.output',

  manifest: {
    name: 'Designer Feedback',
    version: '1.0.1',
    description:
      'Annotate any webpage and share visual feedback with developers',
    permissions: [
      'storage',
      'tabs',
      'downloads',
      'offscreen',
      'activeTab',
      'scripting',
      'contextMenus',
    ],
    commands: {
      'activate-toolbar': {
        suggested_key: {
          default: 'Ctrl+Shift+S',
          mac: 'Command+Shift+S',
        },
        description: 'Open Designer Feedback on the current page',
      },
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'none';",
    },
    action: {
      default_title: 'Click to activate Designer Feedback',
    },
    // CSS must be accessible from all URLs for runtime content script injection
    web_accessible_resources: [
      {
        resources: ['content-scripts/content.css'],
        matches: ['http://*/*', 'https://*/*'],
      },
    ],
  },

  // Maintain old output directory structure for E2E tests
  outDirTemplate: '{{browser}}-mv{{manifestVersion}}',
});
