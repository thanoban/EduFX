# QA Summary Report

## Purpose

Use this document at the end of a test cycle to summarize execution,
defect status, risks, and release confidence.

## Project

- Project name:
- Build number or commit:
- Test environment:
- QA owner:
- Execution period:

## Scope Covered

- Authentication
- Dashboard
- Diagnostic
- Quiz and results
- Behaviour tracking
- API smoke

## Execution Summary

| Metric | Value |
|---|---|
| Total test cases | |
| Passed | |
| Failed | |
| Blocked | |
| Not run | |
| Pass rate | |

## Defect Summary

| Severity | Count |
|---|---|
| Critical | |
| Major | |
| Minor | |
| Cosmetic | |

## Key Findings

- Example: Quiz loading latency creates user-facing failures in slow backend wake-up conditions.
- Example: Results page should not hard-fail when explanation generation is delayed.
- Example: Google callback flow needs stronger session restore handling.

## Risks and Blockers

- Third-party auth instability
- Cloud cold starts
- Missing test data for edge flows

## Recommendation

- Release ready
- Release ready with known minor issues
- Not ready for release

## Sign-off Notes

Record the final decision, known accepted defects, and any follow-up actions.
