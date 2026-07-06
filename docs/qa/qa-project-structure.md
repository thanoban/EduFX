# QA Project Structure

Use the following layout for each QA mini-project so it looks complete,
organized, and professional.

```text
qa-project-name/
├── README.md
├── docs/
│   ├── test-plan.md
│   ├── test-cases.xlsx or test-cases.md
│   ├── bug-report-samples.md
│   └── qa-summary-report.md
├── manual-testing/
│   ├── exploratory-charter.md
│   └── screenshots/
├── automation/
│   ├── tests/
│   ├── pages/ or page_objects/
│   └── reports/
├── api-testing/
│   ├── postman_collection.json
│   ├── environment.json
│   └── schemas/
└── .github/
    └── workflows/
        └── test.yml
```

## What Each Part Means

`README.md`
: short overview of the application under test, scope, tools used, and how to
run the project.

`docs/`
: planning and reporting area for manual and hybrid QA work.

`manual-testing/`
: exploratory notes, execution evidence, screenshots, and tester observations.

`automation/`
: UI automation scripts, reusable page objects, and generated reports.

`api-testing/`
: Postman collections, environments, example payloads, and response schemas.

`.github/workflows/test.yml`
: CI workflow that runs automation or API checks on push or pull request.

## Recommended README Content

Each QA project README should usually contain:

1. Project title
2. System under test
3. Scope of testing
4. Tools used
5. Folder structure
6. How to run automated tests
7. Summary of key findings

## Notes

- If you do not have Excel, use `test-cases.md` instead of `.xlsx`.
- Keep screenshots and bug evidence named clearly, for example
  `BUG_LOGIN_001-invalid-redirect.png`.
- Keep the QA language consistent across all files: scope, severity, priority,
  pass rate, blocked items, and environment details.
