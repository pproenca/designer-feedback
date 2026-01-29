import { defineWebExtConfig } from 'wxt';

export default defineWebExtConfig({
  startUrls: ['https://example.com'],
  // Persist login sessions, devtools extensions between dev restarts
  chromiumArgs: ['--user-data-dir=.wxt/chrome-data'],
});
