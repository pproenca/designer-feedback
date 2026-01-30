# Storage Persistence

Tests annotation persistence across navigation using MCP chrome-devtools.

<prompt>
## Setup
1. Run: `VITE_DF_E2E=1 npm run build`
2. Open Chrome and navigate to chrome://extensions
3. Enable Developer mode
4. Click "Load unpacked" and select `.output/chrome-mv3`
5. Note the extension ID shown on the card

## Test Steps
1. Use `mcp__chrome-devtools__new_page` to open https://example.com
2. Activate extension via test-activate.html:
   `chrome-extension://{extensionId}/test-activate.html?target=https://example.com`
3. Navigate to https://example.com
4. Create an annotation:
   - Click add button
   - Select "Bug" category
   - Click on heading element
   - Fill comment field with "Persistence test"
   - Click save
5. Take snapshot - verify marker visible
6. Navigate to a different path: https://www.iana.org/domains/example (linked from example.com)
7. Navigate back to https://example.com
8. Take snapshot - verify annotation marker still visible with same position
9. Click the clear all/trash button in toolbar
10. Handle confirmation dialog if present via `mcp__chrome-devtools__handle_dialog`
11. Take snapshot - verify all markers removed
</prompt>

<expectation>
- Annotation persists after navigating away and returning to same URL
- Marker appears in same position after navigation
- Clear all removes all annotations from the page
</expectation>
