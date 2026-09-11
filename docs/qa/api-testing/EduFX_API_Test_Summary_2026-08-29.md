# EduFX — Final API Test Summary Report

**Project:** EduFX API Testing System
**SQA Plan:** EduFX SQA Plan – Revised API-Only Scope, v1.1 (29 Aug 2026)
**Test cycle:** API-only, 2-week reduced scope
**Environment under test:** `https://edufx-backend-148945739572.asia-northeast1.run.app` (Cloud Run, `asia-northeast1`)
**API docs:** `/docs` (Swagger UI) · `/openapi.json` (OpenAPI 3.1, title *EduFX MVC API*, 27 paths)
**Execution date (UTC):** 2026-08-29 12:59
**Prepared by:** QA Engineer (senior)
**Tooling:** OpenAPI contract review + scripted HTTP execution (Python `requests`), 3× retry per request, 90 s timeout. Raw evidence in `docs/qa/api-testing/artifacts/` (`test_results.json`, `test_log.csv`).

---

## 1. Executive summary

| Result | Status |
|---|---|
| **Release recommendation** | 🔴 **NOT READY** — a single environment-level defect blocks every data-backed endpoint |
| Exit criteria met | **No** (see §8) |
| Critical defects open | **1** (DEF-001) |
| Planned checks executable this cycle | 73 designed · **43 executed** · **30 blocked** |
| Executed pass rate | 43 / 43 (100%) — *contract, input-validation, authentication-rejection and routing layers only* |
| Functional / business-logic / data-isolation coverage | **0% — could not be exercised** (blocked by DEF-001) |

**Headline finding.** The deployed backend cannot resolve its Supabase database host. Every endpoint that reads or writes data returns **HTTP 500** with the body:

```json
{"success": false, "message": "Unexpected error: [Errno -2] Name or service not known", "data": null}
```

This is a `getaddrinfo` (DNS) failure inside the container — the Supabase project hostname configured in the Cloud Run service either does not resolve, the project is paused/deleted, or egress is misconfigured. `data_backend` is set to `supabase` on this deployment, so there is no in-memory fallback. As a result **15 of the 27 published endpoints have no working success path**, and the remaining functional, positive, boundary, cross-account-isolation and AI-relevance testing defined in the SQA plan **could not be performed**.

What *does* work correctly: the health check, the OpenAPI/Swagger contract, FastAPI request validation (all `422` cases), authentication *rejection* on protected endpoints (`401`), the internal-reminder shared-secret gate (`403`), and HTTP routing/method handling (`404` / `405`).

---

## 2. Environment & entry-criteria assessment

| Entry criterion (SQA §9) | Status | Notes |
|---|---|---|
| API documentation available & matches scope | ✅ Met | `/openapi.json` reachable; 27 paths match the SQA §7 endpoint list 1:1 |
| Test environment running | ⚠️ Partial | Service is up (health `200`) but its database dependency is unreachable |
| Required endpoints accessible | ⚠️ Partial | All routes resolve; 15/27 fail at runtime with `500` |
| Test accounts / tokens / auth details prepared | ✅ Met | `demo:<name>:<email>` bearer tokens accepted by `verify_google_token`; admin role requires a DB-backed `role='admin'` record (unverifiable — DB down) |
| Dummy test data available | ❌ Not met | Data backend unreachable; no seed data could be read or created |
| Test cases reviewed & ready | ✅ Met | 73 checks prepared across 15 areas |

**Conclusion:** entry criteria only partially satisfied. Testing proceeded on the executable subset and the remainder was recorded as **blocked**, per the SQA §14 mitigation for "Test environment or API unavailable".

---

## 3. Execution summary

### 3.1 Overall

| Metric | Value |
|---|---|
| Total checks designed | 73 |
| Executed | 43 |
| Passed | 43 |
| Failed | 0 |
| **Blocked** (DEF-001) | **30** |
| Not run | 0 |
| Executed pass rate | 100% |
| **Planned-scope pass rate** (executed ÷ designed) | **59%** |
| Endpoints with a verified success (2xx) path | **0 / 27** |

> The 100% executed-pass figure must be read with its context: it covers only the layers that sit *in front of* the database (schema validation, auth rejection, routing). No business behaviour was confirmed. The SQA §3 target of ">95% API test case pass rate" and "100% endpoint coverage" is **not achieved** because the majority of cases are blocked, not passed.

### 3.2 By functional area

| Area | Passed | Blocked | Coverage achieved |
|---|---|---|---|
| Health / contract | 5 | 0 | Full |
| Authentication | 5 | 3 | Rejection paths only; login success & `auth/check` blocked |
| Diagnostic | 4 | 2 | Validation only; question list & submit blocked |
| Scheduler (today's plan) | 1 | 2 | Path validation only |
| Content (subtopics / study content) | 1 | 3 | Path validation only |
| Quiz (retrieve / AI generate) | 3 | 2 | Validation only |
| Results (submit / session) | 4 | 2 | Validation only |
| Explanation | 1 | 1 | Path validation only |
| Progress | 2 | 2 | Path validation only |
| Behaviour (snapshot / summary / history) | 4 | 4 | Validation only |
| Settings (availability / next-free) | 4 | 2 | Validation only |
| Teacher (AI chat / report) | 3 | 2 | Validation only |
| Admin (RBAC) | 4 | 2 | Token-absent rejection only; authorised behaviour & `403` for non-admin blocked |
| Internal (reminders) | 2 | 0 | Secret gate verified |
| Cross-account isolation | 0 | 3 | **Not exercised** — see DEF-003 |
| **Total** | **43** | **30** | |

---

## 4. Requirement Traceability Matrix (endpoint coverage)

Legend: ✅ verified · 🟡 partially verified (pre-DB layers only) · ⛔ blocked (no success path) · 🔎 design concern raised

| # | Endpoint | Checks | Outcome |
|---|---|---|---|
| 1 | `GET /` | H-01, H-05 | ✅ health `200`; wrong method `405` |
| 2 | `POST /auth/google` | A-01…A-04 | 🟡 rejects missing/malformed/invalid token (`401`); **⛔ demo-token login → `500`** |
| 3 | `GET /auth/check` | A-05…A-08 | 🟡 header validation `422`; **⛔ lookup → `500`** |
| 4 | `GET /diagnostic/questions` | D-01 | ⛔ `500` |
| 5 | `POST /diagnostic/submit` | D-02…D-06 | 🟡 validation `422` (missing body, missing `student_id`, wrong type, bad `rating` enum); **⛔ valid submit → `500`** |
| 6 | `GET /scheduler/todays-plan/{student_id}` | SC-01…SC-03 | 🟡 non-numeric id `422`; **⛔ valid → `500`** |
| 7 | `GET /content/subtopics` | C-01 | ⛔ `500` |
| 8 | `GET /content/{subtopic_id}/{student_id}` | C-02…C-04 | 🟡 non-numeric `422`; **⛔ valid → `500`** |
| 9 | `GET /quiz/{subtopic_id}/{student_id}` | Q-01, Q-02 | 🟡 non-numeric `422`; **⛔ valid → `500`** |
| 10 | `POST /quiz/generate` | Q-03…Q-05 | 🟡 validation `422`; **⛔ valid AI generate → `500`** |
| 11 | `POST /results/submit-quiz` | R-01…R-04 | 🟡 validation `422` (missing body/fields, wrong `answers` type); **⛔ valid submit → `500`** |
| 12 | `GET /results/session/{session_id}/{student_id}` | R-05, R-06 | 🟡 non-numeric `422`; **⛔ valid → `500`** |
| 13 | `GET /explanation/{session_id}/{student_id}` | E-01, E-02 | 🟡 non-numeric `422`; **⛔ valid → `500`** |
| 14 | `GET /progress/{student_id}` | P-01, P-02 | 🟡 non-numeric `422`; **⛔ valid → `500`** |
| 15 | `GET /progress/{student_id}/{subtopic_id}` | P-03, P-04 | 🟡 non-numeric `422`; **⛔ valid → `500`** |
| 16 | `POST /behaviour/save-snapshot` | B-01…B-03 | 🟡 validation `422`; **⛔ valid save → `500`** |
| 17 | `POST /behaviour/save-summary` | B-04, B-05 | 🟡 validation `422`; **⛔ valid save → `500`** |
| 18 | `GET /behaviour/session/{session_id}` | B-06, B-08 | 🟡 non-numeric `422`; **⛔ valid → `500`** |
| 19 | `GET /behaviour/student/{student_id}` | B-07 | ⛔ `500` |
| 20 | `PUT /settings/{student_id}/availability` | ST-01…ST-04 | 🟡 validation `422` (missing body/field, bad `session_length` enum); **⛔ valid update → `500`** |
| 21 | `POST /settings/{student_id}/next-free` | ST-05, ST-06 | 🟡 bad `choice` enum `422`; **⛔ valid → `500`** |
| 22 | `POST /teacher/{student_id}/chat` | T-01…T-04 | 🟡 validation `422` (missing body/message, bad history `role`); **⛔ valid chat → `500`** |
| 23 | `GET /teacher/{student_id}/report` | T-05 | ⛔ `500` |
| 24 | `GET /admin/students` | AD-01…AD-03 | 🟡 no token / bad token → `401`; **⛔ non-admin token → `500` instead of `403`** |
| 25 | `GET /admin/students/{student_id}` | AD-04 | 🟡 no token → `401`; authorised path ⛔ blocked |
| 26 | `PATCH /admin/students/{student_id}/role` | AD-05, AD-06 | 🟡 no token → `401`; **⛔ role-enum check unreachable (`500`)** |
| 27 | `POST /internal/reminders/run` | IN-01, IN-02 | ✅ missing secret → `403`; wrong secret → `403` (shared secret **is** configured & enforced) |
| — | Cross-account isolation | IS-01…IS-03 | 🔎⛔ no auth/ownership control in code; behaviour unverifiable (`500`) |
| — | Unknown route / TRACE | H-04 | ✅ `404` / `405` |

---

## 5. Defect log

### DEF-001 — Backend cannot reach its database; all data endpoints return HTTP 500  🔴 Critical

| | |
|---|---|
| **Severity** | Critical (SQA §13: "API unavailable for a core flow" + "an important endpoint repeatedly returns server errors") |
| **Status** | New → Open |
| **Affected** | 15 endpoints directly; 30 planned checks blocked; entire functional test scope |
| **Environment** | Cloud Run `edufx-backend-148945739572.asia-northeast1` |

**Steps to reproduce**
1. `GET https://edufx-backend-148945739572.asia-northeast1.run.app/content/subtopics`
2. Observe `HTTP 500`, body `{"success":false,"message":"Unexpected error: [Errno -2] Name or service not known","data":null}`
3. Repeat for `/progress/1`, `/diagnostic/questions`, `POST /auth/google` (valid `demo:` token), `GET /teacher/1/report`, etc. — identical failure.
4. Retried 6× over ~30 s and across the full run — 100% reproducible, not a cold-start transient.

**Analysis**
`[Errno -2] Name or service not known` is a DNS resolution failure raised when the Supabase client opens its connection. `Settings.data_backend` is `"supabase"` on this deployment and `build_repository_bundle` provides **no in-memory fallback** once that mode is selected, so every repository call fails. Health check (`/`) survives only because it touches no repository.

**Cross-check:** the previous backend URL (`https://edufx-backend-rngcuc5r2a-an.a.run.app`, from the project's Postman environment) shows the **identical** failure on the same endpoints. Both deployments are affected, which points to a **Supabase project-level outage** (project paused, deleted, or free-tier auto-pause) rather than a single bad Cloud Run revision.

**Likely causes (for the dev team — QA does not fix):** Supabase project paused/deleted (most likely, given both URLs fail); `SUPABASE_URL` env var wrong/empty on both revisions; VPC connector / egress settings blocking public DNS.

**Impact:** Students cannot log in, take the diagnostic, load content, take quizzes, see progress, or use the AI teacher. Admin console non-functional. This alone makes the build unshippable.

**Retest scope when fixed:** full re-run of all 30 blocked checks + the functional/boundary/isolation/AI-relevance suites that were never reached.

---

### DEF-002 — Internal exception details leaked in 500 response body  🟠 Medium

| | |
|---|---|
| **Severity** | Medium (SQA §14 mitigation requires "controlled API error responses"; this returns raw internals) |
| **Status** | New → Open |
| **Affected** | Global — `install_error_handlers` generic handler in `app/core/errors.py` |

**Detail.** The catch-all handler returns `f"Unexpected error: {exc}"` to the client. Callers currently receive the literal OS error string `[Errno -2] Name or service not known`, which discloses that the backend depends on an external host and that the failure is DNS-level. A production error contract should return a generic message (e.g. *"A backend service is temporarily unavailable"*) and log the detail server-side only.

**Repro.** Any request in DEF-001 — inspect the `message` field.

---

### DEF-003 — Student data endpoints have no authentication or ownership enforcement  🟠 Medium–High (design)

| | |
|---|---|
| **Severity** | Medium now / **Critical if confirmed live** (SQA §13: "another student's data is exposed") |
| **Status** | New → Open — **behaviour could not be executed (blocked by DEF-001); raised from contract + code review** |
| **Affected** | `/scheduler/todays-plan/{id}`, `/content/{sub}/{id}`, `/quiz/{sub}/{id}`, `/results/*`, `/explanation/*`, `/progress/*`, `/behaviour/*`, `/settings/{id}/*`, `/teacher/{id}/*`, `/auth/check` |

**Detail.** None of these routes take a bearer token or verify the caller against the `student_id` in the path/body/header. Any client that knows or guesses a numeric `student_id` (they are sequential integers) can read another student's progress, quiz results, answer explanations, behaviour/proctoring history, and study settings, and can post behaviour data or chat as them. Cross-account checks IS-01…IS-03 were designed to prove this but returned `500` (DEF-001), so the finding is **unverified against the live API** and must be retested once DEF-001 is resolved. The SQA §14 risk register explicitly calls this out as a Critical risk ("One student accessing another student's data").

**Recommended fix (dev team):** require the Supabase bearer token on all student routes and assert `token.sub → student_id` matches the requested resource.

---

### DEF-004 — CORS allows credentialed requests from any `*.run.app` origin  🟡 Low

| | |
|---|---|
| **Severity** | Low (token is sent in a header, not a cookie, which limits practical impact) |
| **Status** | New → Open |
| **Affected** | `app/core/application.py` CORS middleware |

**Detail.** `allow_origin_regex=r"https://.*\.run\.app"` combined with `allow_credentials=True`. Verified:

```
OPTIONS /progress/1   Origin: https://attacker-abc123.run.app
→ 200, access-control-allow-origin: https://attacker-abc123.run.app
     access-control-allow-credentials: true
```

Any site a third party can deploy to Cloud Run (`*.run.app`) is treated as a trusted browser origin. Tighten the regex to the specific frontend project hostname(s).

---

### DEF-005 — `demo:` bearer token bypasses authentication and is not gated by an environment flag  🟡 Low

| | |
|---|---|
| **Severity** | Low (intended for demos) — raise to Medium for a production release |
| **Status** | New → Open |
| **Affected** | `verify_google_token` in `app/core/auth.py` |

**Detail.** Any request with `Authorization: Bearer demo:<name>:<email>` is accepted as that identity with no credential check (verified: A-04 reached the DB layer, i.e. auth passed). The bypass is **not** guarded by `Settings.demo_mode`, so it cannot be turned off by configuration. It should be disabled (or flag-gated) before any real user data is stored.

---

### Positive observations (no defect)

- **Input validation is solid.** All 20 malformed-request checks returned `422` with a proper `HTTPValidationError` body — missing bodies, missing required fields, wrong scalar types, invalid enum values (`rating`, `session_length`, `choice`, chat `role`), and non-numeric path parameters.
- **Authentication rejection is correct.** `POST /auth/google` and every `/admin/*` route return `401` for missing or malformed `Authorization` headers, before any backend work.
- **Internal reminder endpoint is protected.** `POST /internal/reminders/run` returns `403` for both a missing and an incorrect `x-internal-secret` — the shared secret is configured and enforced on this deployment.
- **Routing & method handling are correct.** Unknown routes `404`; disallowed methods (`POST /`, `HEAD /`, `TRACE /`) `405`.
- **Contract is published and accurate.** `/openapi.json` and `/docs` load; the 27 documented paths match the SQA §7 list exactly.

---

## 6. Defect summary

| Severity | Count | IDs |
|---|---|---|
| Critical | 1 | DEF-001 |
| High | 0 | — |
| Medium | 2 | DEF-002, DEF-003 |
| Low | 2 | DEF-004, DEF-005 |
| **Total** | **5** | |

(DEF-003 is scored Medium pending live retest; it becomes Critical if the missing-isolation behaviour is confirmed once DEF-001 is fixed.)

---

## 7. Risk assessment (against SQA §14)

| Risk | Plan level | Materialised? | Note |
|---|---|---|---|
| Test environment / API unavailable | High | **Yes** | DEF-001 — core mitigation invoked; 30 checks recorded blocked |
| Supabase / Vertex AI dependency failure | High | **Yes** | Supabase unreachable; the plan's required control ("EduFX returns *controlled* API error responses") **fails** — see DEF-002 |
| One student accessing another's data | Critical | **Unverified / likely** | DEF-003 — no isolation control in code; live proof blocked |
| Invalid / missing / expired tokens | High | Mitigated | Rejection paths verified for the endpoints that enforce auth |
| Unstable AI response content | Medium | Not assessed | `/quiz/generate`, `/teacher/*` never returned a success response |
| Requirement / endpoint changes | High | No | Contract matches the plan |

---

## 8. Exit-criteria evaluation (SQA §10)

| Exit criterion | Met? | Evidence |
|---|---|---|
| All planned API test cases executed or clearly marked blocked | ⚠️ Partial | 43 executed, 30 explicitly blocked and traced to DEF-001 |
| No critical defects open | ❌ **No** | DEF-001 open |
| No unresolved high-severity defects blocking agreed flows | ❌ **No** | DEF-001 blocks every core flow |
| Final pass rate > 95% | ❌ **No** | 59% of planned scope; functional behaviour 0% verified |
| All agreed endpoints & requirements have test coverage | ⚠️ Partial | Every endpoint has *designed* coverage; 0/27 have a verified success path |
| Fixed defects retested + focused regression done | ❌ N/A | No fixes delivered this cycle |
| Final summary completed & approved | 🔄 In progress | This document |

**Exit criteria are NOT satisfied. The test cycle closes as BLOCKED.**

---

## 9. Recommendation

🔴 **Not ready for release.**

1. **Dev team — fix DEF-001 first.** Restore the Supabase project / correct `SUPABASE_URL` / fix Cloud Run egress. Until a data endpoint returns `2xx`, no further functional QA is possible. As an interim, consider deploying with `data_backend=memory` so the API is at least demonstrable.
2. **Then hand back for a full functional pass.** QA will re-run the 30 blocked checks plus the positive/boundary/business-logic/cross-account/AI-relevance suites that were never reached (quiz scoring correctness, progress updates, diagnostic level placement, behaviour aggregation, admin RBAC actions, AI chemistry relevance sampling).
3. **Address DEF-003 before storing real student data** — it is the highest-impact design gap and is a Critical risk in the SQA plan.
4. **Fold DEF-002, DEF-004, DEF-005 into the same hardening pass.**

**Estimated QA effort after DEF-001 is fixed:** ~3 days (matches the SQA §16 "API test execution" allocation, which has not yet been consumed).

---

## 10. Deliverables produced this cycle

| SQA §11 deliverable | Status |
|---|---|
| API Test Plan / Scenarios / Cases | ✅ 73 checks across 15 areas (this report §4, `test_log.csv`) |
| Requirement Traceability Matrix | ✅ §4 |
| Bug Reports | ✅ §5 (DEF-001…DEF-005) |
| Test execution evidence | ✅ `docs/qa/api-testing/artifacts/test_results.json`, `test_log.csv` |
| Postman collection / environment | ✅ Exists in repo — `docs/qa/api-testing/edufx-api.postman_collection.json` + `edufx-deployed/local.postman_environment.json`. **Action:** update `base_url` in the deployed environment to `https://edufx-backend-148945739572.asia-northeast1.run.app` (currently points at the older URL). This cycle's execution was scripted (`run_tests.py`) for repeatability; the Postman collection covers the same endpoints for manual re-runs |
| Final API Test Summary Report | ✅ This document |

---

## Appendix A — Full check log

See `docs/qa/api-testing/artifacts/test_log.csv` (73 rows: ID, area, test case, request, expected, actual status, verdict, response excerpt).

## Appendix B — Sign-off

| Role | Name | Decision | Signature | Date |
|---|---|---|---|---|
| QA Engineer | | Cycle closed — BLOCKED, not ready | | |
| Project Supervisor | | | | |

**Accepted / known issues carried forward:** DEF-001 (blocker), DEF-002–005 (hardening backlog).
**Follow-up action:** dev to resolve DEF-001, then request functional re-test.
