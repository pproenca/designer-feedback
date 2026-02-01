# Toolbar State Machine

Tests toolbar UI state transitions using MCP chrome-devtools.

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
4. Take snapshot - verify toolbar collapsed (minimal state)
5. Click expand/hamburger button on toolbar
6. Take snapshot - verify toolbar expanded with all buttons visible
7. Click add (+) button
8. Take snapshot - verify category panel visible with 4 categories (Bug, Suggestion, Question, Accessibility)
9. Click "Suggestion" category
10. Take snapshot - verify selection overlay visible (selection mode active)
11. Press Escape key via `mcp__chrome-devtools__press_key` with key "Escape"
12. Take snapshot - verify back to idle state (no overlay, no category panel)
</prompt>

<expectation>
- Toolbar toggles between collapsed/expanded
- Add button opens category panel
- Category selection enables selection mode (overlay visible)
- Escape key cancels selection mode and returns to idle
</expectation>
