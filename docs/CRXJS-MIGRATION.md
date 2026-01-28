# CRXJS Migration Guide

This document outlines the migration path should CRXJS become unmaintained. As of January 2025, the project is seeking maintainers with a potential archive date of June 2025.

## Current Setup

The project uses `@crxjs/vite-plugin` v2.0.0-beta.28 with the following configuration:

```typescript
// vite.config.ts
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
});
```

**Benefits of current setup:**
- Zero-config manifest handling
- Automatic web_accessible_resources generation
- HMR support for popup/options pages
- Direct manifest.json import

## Alternative 1: WXT Framework (Recommended)

[WXT](https://wxt.dev/) is the recommended migration target with an [official CRXJS migration guide](https://wxt.dev/guide/migration/crxjs.html).

### Why WXT?

- Active maintenance and development
- Built-in TypeScript support
- Automatic manifest generation
- Cross-browser support (Chrome, Firefox, Safari)
- HMR for all extension contexts
- First-class Vite integration

### Migration Steps

1. **Install WXT:**
   ```bash
   npm install -D wxt
   ```

2. **Update project structure:**
   ```
   # CRXJS structure
   src/
   ├── background/
   ├── content/
   └── popup/
   manifest.json

   # WXT structure
   src/
   ├── entrypoints/
   │   ├── background.ts
   │   ├── content.ts
   │   └── popup/
   │       ├── index.html
   │       └── main.tsx
   └── components/
   wxt.config.ts
   ```

3. **Create wxt.config.ts:**
   ```typescript
   import { defineConfig } from 'wxt';

   export default defineConfig({
     srcDir: 'src',
     entrypointsDir: 'entrypoints',
     manifest: {
       name: 'Designer Feedback',
       permissions: ['tabs', 'storage'],
       optional_host_permissions: ['https://*/*', 'http://*/*'],
     },
   });
   ```

4. **Update content script:**
   ```typescript
   // src/entrypoints/content.ts
   export default defineContentScript({
     matches: ['<all_urls>'],
     main() {
       // Content script logic
     },
   });
   ```

5. **Update package.json scripts:**
   ```json
   {
     "scripts": {
       "dev": "wxt",
       "build": "wxt build",
       "zip": "wxt zip"
     }
   }
   ```

## Alternative 2: vite-plugin-web-extension

[vite-plugin-web-extension](https://vite-plugin-web-extension.aklinker1.io/) is a lighter alternative with simpler configuration.

### Migration Steps

1. **Install the plugin:**
   ```bash
   npm install -D vite-plugin-web-extension
   ```

2. **Update vite.config.ts:**
   ```typescript
   import webExtension from 'vite-plugin-web-extension';

   export default defineConfig({
     plugins: [
       react(),
       webExtension({
         manifest: 'manifest.json',
         watchFilePaths: ['src/**/*'],
       }),
     ],
   });
   ```

3. **Adjust manifest.json:**
   - Keep most structure the same
   - May need to adjust paths for entry points

### Comparison

| Feature | WXT | vite-plugin-web-extension |
|---------|-----|---------------------------|
| Manifest generation | Automatic | Manual (JSON file) |
| Cross-browser | Built-in | Requires configuration |
| HMR | All contexts | Popup/options only |
| Learning curve | Higher | Lower |
| Active maintenance | Yes | Yes |
| TypeScript | First-class | Supported |

## Decision Criteria

**Migrate when:**
- CRXJS is officially archived
- Security vulnerabilities are discovered
- Build issues occur that can't be resolved
- New Chrome extension features aren't supported

**Stay with CRXJS if:**
- Project works without issues
- Community fork emerges with active maintenance
- Migration cost outweighs benefits

## Migration Checklist

- [ ] Back up current working configuration
- [ ] Create a migration branch
- [ ] Install new plugin/framework
- [ ] Update project structure
- [ ] Update configuration files
- [ ] Test all extension features:
  - [ ] Content script injection
  - [ ] Popup functionality
  - [ ] Background service worker
  - [ ] Storage operations
  - [ ] Permission handling
- [ ] Test HMR in development
- [ ] Verify production build
- [ ] Test extension installation from build output
- [ ] Update CI/CD pipelines if applicable

## Resources

- [WXT Documentation](https://wxt.dev/)
- [WXT CRXJS Migration Guide](https://wxt.dev/guide/migration/crxjs.html)
- [vite-plugin-web-extension Documentation](https://vite-plugin-web-extension.aklinker1.io/)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
