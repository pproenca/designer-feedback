import {defineConfig} from 'wxt';

const isE2E = process.env.VITE_DF_E2E === '1';

export default defineConfig({
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  srcDir: '.',
  outDir: '.output',

  manifest: ({browser}) => {
    const permissions = [
      'storage',
      'downloads',
      'activeTab',
      'scripting',
      'contextMenus',
    ];

    if (browser !== 'firefox') {
      permissions.push('offscreen');
    }

    if (isE2E) {
      permissions.push('tabs');
    }

    return {
      name: 'Designer Feedback',
      description:
        'Annotate any webpage and share visual feedback with developers',
      permissions,
      commands: {
        'activate-toolbar': {
          suggested_key: {
            default: 'Ctrl+Shift+S',
            mac: 'Command+Shift+S',
          },
          description: 'Toggle Designer Feedback on the current page',
        },
      },
      content_security_policy: {
        extension_pages: "script-src 'self'; object-src 'none';",
      },
      action: {
        default_title: 'Click to toggle Designer Feedback',
      },
      // CSS must be accessible from all URLs for runtime content script injection
      web_accessible_resources: [
        {
          resources: ['content-scripts/content.css'],
          matches: ['http://*/*', 'https://*/*'],
        },
      ],
    };
  },

  // Maintain old output directory structure for E2E tests
  outDirTemplate: '{{browser}}-mv{{manifestVersion}}',
});
