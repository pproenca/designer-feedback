import {readFileSync} from 'node:fs';
import {defineConfig} from 'wxt';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {version?: string};

const manifestVersion =
  process.env.EXTENSION_VERSION?.trim() || packageJson.version || '0.0.0';

export default defineConfig({
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  srcDir: '.',
  outDir: '.output',

  manifest: {
    name: 'Designer Feedback',
    version: manifestVersion,
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
