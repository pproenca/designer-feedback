# Screenshot Export Flow

<prompt>
Run the E2E test that exercises the screenshot export flow:

1. Run `npm run test:e2e -- --grep "happy path: create annotation and open export modal"`
2. Report whether the test passed or failed
3. If it failed, include the error output

This test:
- Opens the extension toolbar on example.com
- Creates an annotation on a page element
- Opens the export modal
- Verifies the annotation appears in the export preview
- Closes the modal

Note: The test must be run against a built extension. If the build doesn't exist, run `npm run build` first.
</prompt>

<expectation>
The E2E test passes successfully. The test output shows:
- 1 passed test
- No failures or errors
- The "happy path: create annotation and open export modal" test completed
</expectation>
