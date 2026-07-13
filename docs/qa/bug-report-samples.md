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

### BUG_QUIZ_002 (real, found and fixed 2026-07-07)

- Title: `GET /quiz/{subtopic_id}/{student_id}` crashes with an unhandled `KeyError` for a subtopic that doesn't exist, instead of a clean `404`
- Environment: Backend integration test suite (`pytest`), memory data backend — same code path runs in the deployed Supabase-backed backend
- Steps to Reproduce:
  1. Log in as any student (`POST /auth/google` with a `demo:` token)
  2. `GET /quiz/9999999/{student_id}` (a subtopic id that doesn't exist)
- Expected Result: `404 Not Found`, matching the same-shaped 404 the sibling `/content/{subtopic_id}/{student_id}` route already returns for the same scenario
- Actual Result (before fix): unhandled `KeyError` in `QuizRepository.get_progress()` — in a real deployed server this is caught by the generic `Exception` handler and returned as a `500` with an unhelpful `"Unexpected error: (2, 9999999)"` message, rather than a proper `404`
- Severity: Minor (no data exposure, but wrong status code and a leaky error message)
- Priority: Medium
- Root cause: `QuizRepository.get_progress()` (`server/app/repositories/quiz_repository.py`) indexed the in-memory progress dict directly instead of checking for the key first, unlike the equivalent `ContentRepository.get_subtopic()` and the Supabase-backed `SupabaseQuizRepository.get_progress()` (which already used `mapper.ensure_one(..., status_code=404)` correctly — only the memory-backend path had the bug)
- Fix: added an explicit key check that raises `EduFXError("Progress not found", status_code=404)`, matching the pattern already used elsewhere in the codebase
- Regression test: `server/tests/integration/test_api_negative_cases.py::test_quiz_for_unknown_subtopic_returns_404`
- Found via: automated negative-path API testing (see [automated-api-testing-guide.md](automated-api-testing-guide.md)) — this is exactly the kind of bug happy-path testing alone never catches

### BUG_RESULTS_002 (real, found and fixed 2026-07-07)

- Title: `GET /results/session/{session_id}/{student_id}` (and the sibling `GET /explanation/{session_id}/{student_id}`) did not verify that the session actually belongs to `student_id`
- Environment: Backend integration test suite (`pytest`); applied identically to the deployed backend before the fix
- Steps to Reproduce:
  1. Student A completes a quiz, producing a `session_id`
  2. Student B calls `GET /results/session/{session_id}/{student_b_id}`
- Expected Result: `404` — student B should not be able to read student A's quiz results
- Actual Result (before fix): `200`, with student A's real quiz score, per-question attempts, and correct answers returned (the response DTO's `student_id` field was just echoed back from the URL, never derived from or checked against the actual session owner)
- Severity: Major (real cross-student data exposure — quiz scores and answer history)
- Priority: High
- Root cause: `ResultsService.get_session_results()` and `ExplanationService.get_explanations()` (`server/app/services/results_service.py`, `explanation_service.py`) fetched the session by `session_id` alone and never compared `session.student_id` to the `student_id` argument
- Fix: both services now raise `EduFXError("Session not found", status_code=404)` immediately after fetching the session if `session.student_id != student_id` — a 404 rather than 403, so an unauthorized caller can't use the response to confirm a `session_id` is real
- Regression tests: `server/tests/integration/test_api_negative_cases.py::test_results_session_for_wrong_student_is_rejected` and `::test_explanation_session_for_wrong_student_is_rejected`
- Found via: automated negative-path API testing while building out this project's QA test suite — this was caught, fixed, and verified *before* the QA docs describing it were published, specifically to avoid publishing exploit details for a live unpatched bug in this public repo
- Still open, tracked separately: most other non-admin routes in this app trust `student_id` path params by design without deriving them from the auth token (see [api-testing-guide.md §7](api-testing-guide.md#7-known-gaps-worth-testing-for)) — this fix covers the two routes found so far, not a systemic redesign of that pattern

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
