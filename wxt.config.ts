import {defineConfig} from 'wxt';

const isE2E = process.env.VITE_DF_E2E === '1';
const e2eHostPermissionsMode = process.env.E2E_HOST_PERMISSIONS ?? 'strict';
const defaultEntrypoints = ['background', 'content', 'offscreen'] as const;
const e2eEntrypoints = [...defaultEntrypoints, 'test-activate'] as const;

export default defineConfig({
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  srcDir: '.',
  outDir: '.output',
  manifestVersion: 3,
  filterEntrypoints: isE2E ? [...e2eEntrypoints] : [...defaultEntrypoints],

  manifest: ({browser}) => {
    const hostPermissions =
      isE2E && e2eHostPermissionsMode === 'broad'
        ? ['http://*/*', 'https://*/*']
        : undefined;
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
      content_security_policy: {
        extension_pages: "script-src 'self'; object-src 'none';",
      },
      action: {
        default_title: 'Click to toggle Designer Feedback',
      },
      ...(hostPermissions ? {host_permissions: hostPermissions} : {}),
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
