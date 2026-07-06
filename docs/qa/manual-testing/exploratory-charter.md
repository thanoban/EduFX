# Exploratory Testing Charter

Use this template for a short, focused exploratory session.

## Charter Information

- Session ID:
- Tester:
- Date:
- Feature area:
- Duration:

## Mission

Explore the selected feature to uncover usability issues, logic problems,
unexpected states, and error-handling gaps.

## Example Charter

- Feature area: EduFX quiz and results flow
- Mission: Explore how the quiz behaves under slow responses, refreshes,
  navigation changes, and partial backend failure.

## Test Ideas

- Open the flow from multiple entry points
- Refresh during loading
- Navigate back and forward between pages
- Use invalid or missing route parameters
- Simulate slow network conditions
- Observe UI feedback, recovery, and error messaging

## Observations

- Note unusual delays
- Note inconsistent text or layout issues
- Record whether the system recovers automatically

## Bugs Found

- Bug ID:
- Short title:
- Severity:
- Evidence file:

## Follow-up

- Retest after fix
- Convert recurring findings into formal regression test cases
