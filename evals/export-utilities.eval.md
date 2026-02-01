# Export Utilities

Tests export modal and preview functionality using MCP chrome-devtools.

<prompt>
## Setup
1. Run: `VITE_DF_E2E=1 npm run build`
2. Open Chrome and navigate to chrome://extensions
3. Enable Developer mode
4. Click "Load unpacked" and select `.output/chrome-mv3`
5. Note the extension ID shown on the card

## Test Steps
1. Use `mcp__chrome-devtools__new_page` to open https://example.com
2. Activate extension via test-activate (extensionBaseUrl = protocol + extension id):
   `{extensionBaseUrl}/test-activate.html?target=https://example.com`
3. Navigate to https://example.com
4. Create an annotation:
   - Click add button
   - Select "Bug" category
   - Click on heading element
   - Fill comment field with "Export test annotation"
   - Click save
5. Click export button in toolbar (download/share icon)
6. Take snapshot - verify export modal visible
7. Verify snapshot shows annotation preview with:
   - "Export test annotation" text visible
   - "Bug" category label or indicator
8. Click close/X button on modal
9. Take snapshot - verify modal closed and toolbar still visible
</prompt>

<expectation>
- Export modal opens when export button clicked
- Annotation preview shows comment text "Export test annotation"
- Category (Bug) is indicated in preview
- Modal closes properly when X clicked
- Toolbar remains functional after modal close
</expectation>
