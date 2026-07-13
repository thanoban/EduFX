# Test Plan

## Objective

Define the QA scope, approach, environments, and completion criteria for the
application under test.

## Project Information

- Project name: `EduFX` — adaptive A-Level Chemistry study platform
- Application type: Hybrid — Next.js 15 frontend + FastAPI backend, deployed
  on GCP Cloud Run, backed by Supabase Postgres
- Test level: Smoke, functional, exploratory, regression, API (both manual
  and automated — see [api-testing-guide.md](api-testing-guide.md) and
  [automated-api-testing-guide.md](automated-api-testing-guide.md))
- Build or environment: Local (`memory` or `supabase` data backend) and the
  deployed Cloud Run backend/frontend — see
  [environment guidance](api-testing-guide.md#6-environment-guidance-what-is-and-isnt-safe-to-test-against)

## Scope

### In Scope

- Authentication and session flow
- Dashboard and navigation
- Quiz and results workflow
- Webcam or behavioural tracking flow
- API validation for key endpoints

### Out of Scope

- Third-party outages outside team control
- Browser/device combinations not targeted in the project
- Performance testing beyond smoke-level checks unless explicitly included

## Test Types

- Smoke testing
- Functional testing
- Exploratory testing
- Regression testing
- API testing
- Basic compatibility testing

## Test Environment

- OS: Windows 11
- Browser: Chrome latest stable
- Network: Standard broadband
- Backend: Demo or staging API
- Database: Supabase or test fixture dataset

## Entry Criteria

- Build is deployed or available locally
- Test accounts are ready
- Test data is prepared
- Core environment setup is complete

## Exit Criteria

- All high-priority test cases executed
- Critical and blocker defects are resolved or accepted
- QA summary report is completed
- Evidence for major defects is attached

## Risks

- Unstable third-party auth or cloud services
- Limited seed data for some feature paths
- Slow backend warm-up causing false timeout failures

## Deliverables

- Test cases
- Bug reports
- Exploratory notes
- API checklist or Postman evidence
- QA summary report
