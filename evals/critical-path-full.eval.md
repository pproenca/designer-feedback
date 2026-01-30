# Critical Path - Full User Journey

Complete end-to-end user journey test using MCP chrome-devtools.

<prompt>
## Setup
1. Run: `VITE_DF_E2E=1 npm run build`
2. Open Chrome and navigate to chrome://extensions
3. Enable Developer mode
4. Click "Load unpacked" and select `.output/chrome-mv3`
5. Note the extension ID shown on the card

## Full User Journey
1. Use `mcp__chrome-devtools__new_page` to open https://example.com
2. Activate extension via test-activate.html:
   `chrome-extension://{extensionId}/test-activate.html?target=https://example.com`
3. Navigate to https://example.com
4. Take snapshot - verify toolbar visible [data-toolbar]
5. Click add button
6. Take snapshot - verify category panel with Bug, Suggestion, Question, Accessibility
7. Select "Bug" category
8. Take snapshot - verify selection overlay active
9. Click on main heading element ("Example Domain")
10. Take snapshot - verify annotation popup appears with element info
11. Fill comment field with "This heading needs better contrast"
12. Click save/submit button
13. Take snapshot - verify marker appears at heading location [data-annotation-marker]
14. Click export button in toolbar
15. Take snapshot - verify export modal shows:
    - "Bug" label/indicator
    - "This heading needs better contrast" text
16. Close export modal (click X)
17. Take snapshot - verify modal closed
18. Click the marker to select the annotation
19. Take snapshot - verify annotation popup shows with delete option
20. Click delete button
21. Take snapshot - verify marker removed
22. Click close/X button on toolbar
23. Take snapshot - verify toolbar hidden/collapsed
</prompt>

<expectation>
All steps complete successfully:
- Extension activates and shows toolbar
- Category panel shows 4 categories
- Selection mode activates with overlay
- Annotation created with category and comment
- Marker visible at correct position near heading
- Export preview shows annotation details with Bug label
- Deletion removes marker from page
- Toolbar can be closed/collapsed
</expectation>
