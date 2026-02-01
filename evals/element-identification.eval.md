# Element Identification

Tests that element names display correctly in annotation popup using MCP chrome-devtools.

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
4. Start annotation flow:
   - Click add button
   - Select any category
5. Click on the "More information..." link
6. Take snapshot - verify popup shows element name containing "link" or the link text
7. Press Escape to cancel
8. Start another annotation:
   - Click add button
   - Select any category
9. Click on the main heading "Example Domain"
10. Take snapshot - verify popup shows element name containing "h1" or "Example Domain"
</prompt>

<expectation>
- Links identified as "link" with visible text or href
- Headings identified as h1/h2/etc or with their text content
- Element names appear in annotation popup for user context
</expectation>
