# Test Cases

Use this structure for manual test cases when you do not want to maintain an
Excel sheet.

## Manual Test Case Template

| Field | Example |
|---|---|
| Test Case ID | `TC_LOGIN_001` |
| Title | Verify user can login with valid credentials |
| Precondition | User account exists and application is available |
| Steps | 1. Open app 2. Enter username 3. Enter password 4. Click Login |
| Test Data | username: `valid_user`, password: `valid_password` |
| Expected Result | User is redirected to dashboard or home page |
| Actual Result | Fill after execution |
| Status | Pass / Fail / Blocked |
| Priority | High / Medium / Low |

## EduFX Example Cases

### TC_LOGIN_001

- Title: Verify user can login with valid credentials
- Precondition: User account exists and Google auth flow is configured
- Steps:
  1. Open the EduFX login page
  2. Click the sign-in action
  3. Complete the configured authentication flow
  4. Return to EduFX
- Test Data: Valid user account
- Expected Result: User reaches dashboard or diagnostic flow
- Actual Result: Pending execution
- Status: Not run
- Priority: High

### TC_DIAG_001

- Title: Verify diagnostic can be started by a first-time student
- Precondition: Student has not completed diagnostic
- Steps:
  1. Login to EduFX
  2. Open diagnostic
  3. Confirm first question is displayed
  4. Move to the next question
- Test Data: New student profile
- Expected Result: Diagnostic opens and question navigation works
- Actual Result: Pending execution
- Status: Not run
- Priority: High

### TC_QUIZ_001

- Title: Verify quiz page loads questions successfully
- Precondition: Student has an active topic or quiz route
- Steps:
  1. Open the quiz page
  2. Wait for question content
  3. Select an answer
  4. Continue to the next step
- Test Data: Active quiz ID
- Expected Result: Question content appears within acceptable time and accepts input
- Actual Result: Pending execution
- Status: Not run
- Priority: High

### TC_RESULTS_001

- Title: Verify results page shows score and explanation data
- Precondition: A completed quiz attempt exists
- Steps:
  1. Submit a quiz
  2. Open the results page
  3. Review score, explanation, and focus summary
- Test Data: Completed quiz attempt
- Expected Result: Results page loads with performance and explanation details
- Actual Result: Pending execution
- Status: Not run
- Priority: High
