# Bug Report Samples

Use this format to log defects clearly and consistently.

## Bug Report Template

| Field | Example |
|---|---|
| Bug ID | `BUG_CART_001` |
| Title | Cart total does not update after quantity change |
| Environment | Chrome 126, Windows 11, staging or demo |
| Steps to Reproduce | 1. Add item to cart 2. Change quantity from 1 to 2 3. Click update |
| Expected Result | Total price should double |
| Actual Result | Total price remains unchanged |
| Severity | Major |
| Priority | High |
| Evidence | Screenshot, video, logs attached |

## EduFX Example Bug Reports

### BUG_QUIZ_001

- Title: Quiz page stays in loading state too long and then fails
- Environment: Chrome on Windows 11, deployed frontend, live backend
- Steps to Reproduce:
  1. Open an EduFX quiz route
  2. Wait for the question payload
  3. Observe the loading skeleton
- Expected Result: Quiz question should load in a reasonable time
- Actual Result: Page stays loading and may end with "Quiz could not load"
- Severity: Major
- Priority: High
- Evidence: Screenshot or browser console log

### BUG_RESULTS_001

- Title: Results page fails when explanation request takes too long
- Environment: Chrome on Windows 11, deployed frontend
- Steps to Reproduce:
  1. Complete a quiz
  2. Open the results page
  3. Wait for explanation data
- Expected Result: Results page should show score and degrade gracefully if explanation is delayed
- Actual Result: Results screen may fail to load fully
- Severity: Major
- Priority: High
- Evidence: Screenshot of error state, network trace

### BUG_AUTH_001

- Title: Authentication callback completes but session is not restored
- Environment: Chrome, staging or local auth callback flow
- Steps to Reproduce:
  1. Start login
  2. Complete provider auth
  3. Return to callback route
- Expected Result: User should be redirected into EduFX with an active session
- Actual Result: User sees callback error or is returned to login
- Severity: Critical
- Priority: High
- Evidence: Screenshot and callback URL details
