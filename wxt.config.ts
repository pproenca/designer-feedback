import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: '.',
  outDir: '.output',

  manifest: {
    name: 'Designer Feedback',
    version: '1.0.0',
    description: 'Annotate any webpage and share visual feedback with developers',
    permissions: ['storage', 'tabs', 'downloads', 'activeTab', 'scripting'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'none';",
    },
    action: {
      default_title: 'Click to activate Designer Feedback',
    },
  },

  runner: {
    startUrls: ['https://example.com'],
  },
});
