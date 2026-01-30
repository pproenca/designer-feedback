# Annotation Store CRUD Operations

Tests creating, viewing, and deleting annotations via browser UI using MCP chrome-devtools.

<prompt>
## Setup
1. Run: `VITE_DF_E2E=1 npm run build`
2. Open Chrome and navigate to chrome://extensions
3. Enable Developer mode
4. Click "Load unpacked" and select `.output/chrome-mv3`
5. Note the extension ID shown on the card

## Test Steps
1. Use `mcp__chrome-devtools__new_page` to open https://example.com
2. Use `mcp__chrome-devtools__navigate_page` to activate via test-activate.html:
   `chrome-extension://{extensionId}/test-activate.html?target=https://example.com`
3. Wait for activation, then navigate back to https://example.com
4. Use `mcp__chrome-devtools__take_snapshot` - verify toolbar with [data-toolbar] visible
5. Click the add button (uid with "Add" or plus icon)
6. Take snapshot - verify category panel visible
7. Click "Bug" category
8. Take snapshot - verify selection mode active (overlay visible)
9. Click on the page heading element ("Example Domain")
10. Take snapshot - verify annotation popup appears
11. Use `mcp__chrome-devtools__fill` to enter "Test annotation" in comment field
12. Click save/submit button
13. Take snapshot - verify annotation marker visible [data-annotation-marker]
14. Click the marker to select it
15. Click delete button in popup
16. Take snapshot - verify marker removed
</prompt>

<expectation>
- Toolbar visible after activation
- Category panel opens on add click
- Annotation popup appears after element click
- Marker appears after save
- Marker removed after delete
</expectation>
