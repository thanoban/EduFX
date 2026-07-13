# QA Documentation

This section organizes QA artifacts in a way that looks professional for
portfolio work, team handoff, and viva discussion.

## Core QA Docs

- [QA project structure](qa-project-structure.md)
  Recommended folder layout for each QA mini-project.
- [Test plan](test-plan.md)
  What to test, how to test it, entry/exit criteria, and scope.
- [Test cases](test-cases.md)
  Reusable manual test case format with EduFX examples.
- [Bug report samples](bug-report-samples.md)
  Clear issue logging format — including two real defects found while
  building this project's automated API test suite (one fixed, one open).
- [QA summary report](qa-summary-report.md)
  End-of-cycle testing summary for stakeholders.
- [API testing checklist](api-testing-checklist.md)
  Practical assertions for API functional and negative testing.

## API Testing (grounded in the real EduFX endpoints)

- [API testing guide (manual)](api-testing-guide.md)
  Endpoint-by-endpoint reference for every EduFX route — auth model, real
  `curl` examples, expected responses, negative cases, and a manual test
  case matrix. The primary "how do I test this API by hand" document.
- [Automated API testing guide](automated-api-testing-guide.md)
  How the existing `pytest` + FastAPI `TestClient` suite is built, how to
  run it, how to extend it, and the CI workflow that runs it on every push.
- [Postman collection](api-testing/edufx-api.postman_collection.json) +
  [local](api-testing/edufx-local.postman_environment.json) /
  [deployed](api-testing/edufx-deployed.postman_environment.json)
  environments
  Importable, ready-to-run manual API testing artifacts.

## Manual Testing

- [Exploratory charter](manual-testing/exploratory-charter.md)
  Session-based exploratory testing format for guided bug hunting.

## How To Use This Folder

For a standalone QA project, create a dedicated folder that follows the
structure in [qa-project-structure.md](qa-project-structure.md). Use the
templates in this section as the starting point for that project’s test
documents, bug logs, and execution reports.
