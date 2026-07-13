# EduFX API Testing Guide (Manual)

This is a real, endpoint-by-endpoint testing guide for the EduFX FastAPI
backend — grounded in the actual routes, request/response models, and auth
rules in this codebase, not generic placeholder examples. Use it to test the
API by hand with `curl`, Postman/Insomnia, or the bundled
[Postman collection](api-testing/edufx-api.postman_collection.json).

For the automated equivalent of this guide (pytest + `TestClient`), see
[automated-api-testing-guide.md](automated-api-testing-guide.md).

## 1. Environments

| Environment | Base URL | Notes |
|---|---|---|
| Local | `http://127.0.0.1:8001` | `cd server && uvicorn app.main:app --reload --port 8001` |
| Deployed (Cloud Run) | `https://edufx-backend-rngcuc5r2a-an.a.run.app` | Live Supabase-backed data — see [environment guidance](#6-environment-guidance-what-is-and-isnt-safe-to-test-against) before writing test data here |

Every response is wrapped in the same envelope:

```json
{ "success": true, "message": "Request completed", "data": { /* ... */ } }
```

Errors use the same shape with `"success": false` and `"data": null`:

```json
{ "success": false, "message": "Student not found", "data": null }
```

## 2. Authentication — the demo-token trick

Most routes accept a bearer token that identifies a student. Real Google
sign-in produces a Supabase-issued JWT, which is awkward to generate by hand
for testing. The backend has a **first-class test path** built in:
`verify_google_token()` (`server/app/core/auth.py`) special-cases any token
starting with `demo:`, in the form:

```
Authorization: Bearer demo:<Display Name>:<email>
```

This works identically against the local server *and* the deployed Cloud Run
backend, on both the memory and Supabase data backends, with no real OAuth
flow involved — it's exactly what the automated integration tests use (see
`server/tests/integration/test_api_flow.py`). Use a unique email per test
run/scenario so you don't collide with other testers' data:

```bash
curl -s -X POST "$BASE_URL/auth/google" \
  -H "Authorization: Bearer demo:QA Tester:qa-tester-001@edufx.demo"
```

```json
{
  "success": true,
  "message": "Request completed",
  "data": {
    "student_id": 42,
    "name": "QA Tester",
    "email": "qa-tester-001@edufx.demo",
    "diagnostic_completed": false,
    "is_admin": false,
    "free_days": [],
    "session_length": "medium",
    "day_session_length": {},
    "next_expected_date": null,
    "email_reminders_enabled": true,
    "current_streak": 0,
    "longest_streak": 0,
    "last_study_date": null
  }
}
```

First call for a new email **creates** the student; subsequent calls with the
same email log back into the same account. Save `student_id` — most other
endpoints take it as a path parameter (the API trusts the path `student_id`
directly rather than deriving it from the token on most routes — see the
[security notes](#7-known-gaps-worth-testing-for) below, this is itself
something worth probing).

### Admin routes

`GET /admin/*` and `PATCH /admin/*` are the only routes that actually check
the bearer token server-side (`require_admin` in `routes/admin.py`) against
a real `role` column on the student record, rather than trusting a path
parameter. A `demo:` token only gets admin access if that email's student row
already has `role = 'admin'` in the database — you can't self-promote via the
demo-token trick.

## 3. Endpoint Reference

### Auth (`/auth`)

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/auth/google` | `Authorization: Bearer demo:<name>:<email>` or a real Supabase JWT | none |
| GET | `/auth/check` | `X-Student-Id: <id>` header | none |

```bash
curl -s "$BASE_URL/auth/check" -H "X-Student-Id: 42"
```

**Negative cases:**
- No `Authorization` header on `/auth/google` → `401`
- No `X-Student-Id` header on `/auth/check` → `422` (FastAPI's own header validation, before the route body runs)

### Diagnostic (`/diagnostic`)

| Method | Path | Body |
|---|---|---|
| GET | `/diagnostic/questions` | none |
| POST | `/diagnostic/submit` | `DiagnosticSubmitRequest` |

`GET /diagnostic/questions` returns 4 questions per subtopic × 10 subtopics
= 40 questions. `POST /diagnostic/submit` **requires all 40 answers** —
this is enforced (see negative case below), and produces a per-subtopic
placement.

```bash
curl -s -X POST "$BASE_URL/diagnostic/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 42,
    "answers": [
      { "question_id": 1, "subtopic_id": 1, "student_answer": "A" }
    ],
    "self_assessments": [
      { "subtopic_id": 1, "rating": "weak" }
    ]
  }'
```

`self_assessments` is optional; `rating: "weak"` is trusted outright and
places that subtopic at `beginner`, while `"confident"` is cross-checked
against the actual quiz score rather than taken at face value.

**Negative cases:**
- Fewer than 40 answers → `422`
- Unknown `student_id` → `4xx`, `success: false`

### Scheduler (`/scheduler`)

| Method | Path |
|---|---|
| GET | `/scheduler/todays-plan/{student_id}` |

Returns 3 recommended subtopics/day (2 "weak" + 1 "strong", per
`compute_priority()` in `app/core/rules.py`, or the ML recommender if
enabled — see [recommender docs](../ml-recommender/recommender-learning-basics.md)).
Requires the diagnostic to be completed first.

### Content (`/content`)

| Method | Path |
|---|---|
| GET | `/content/subtopics` |
| GET | `/content/{subtopic_id}/{student_id}` |

**Important business rule to test around:** content access is gated by the
student's *current adaptive recommendation*, not just "does this subtopic
exist." `ContentService._assert_active_recommendation()` returns `403` if
the requested `subtopic_id` isn't the student's currently unlocked topic —
**even for a subtopic_id that doesn't exist**, because the gate check runs
before the existence check. This is intentional design, not a bug — a good
example of why "test the actual precedence of validation steps," not just
"does bad input 404," matters.

```bash
# 403 even though 9999999 doesn't exist — gating runs first
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/content/9999999/42"
```

### Quiz (`/quiz`)

| Method | Path | Body |
|---|---|---|
| GET | `/quiz/{subtopic_id}/{student_id}` | none |
| POST | `/quiz/generate` | `GenerateQuizRequest` |

First visit to a subtopic returns `stage: "first"` (15 manually-authored
questions). Re-visiting after a completed attempt returns
`stage: "personalized"` with AI/rule-generated questions
(`source: "live-gen"`), prioritized toward previously-wrong concepts.

**Negative case:**
- `subtopic_id` that doesn't exist → `404` (`"Progress not found"`)

### Results (`/results`)

| Method | Path | Body |
|---|---|---|
| POST | `/results/submit-quiz` | `QuizSubmitRequest` |
| GET | `/results/session/{session_id}/{student_id}` | none |

```bash
curl -s -X POST "$BASE_URL/results/submit-quiz" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 42,
    "session_id": 7,
    "subtopic_id": 1,
    "webcam_enabled": false,
    "answers": [ { "question_id": 101, "student_answer": "A" } ]
  }'
```

**⚠️ Known gap, worth re-testing after the linked fix lands:**
`GET /results/session/{session_id}/{student_id}` does not currently verify
that `session_id` actually belongs to `student_id` — any `student_id` value
in the URL is accepted and just echoed back into the response, while the
underlying session data returned is whoever really owns that `session_id`.
Try requesting a session with a `student_id` that isn't its real owner; see
[bug-report-samples.md](bug-report-samples.md#bug_results_002) for the full
write-up. There's a `pytest.mark.xfail(strict=True)` regression test for
this at `server/tests/integration/test_api_negative_cases.py::test_results_session_for_wrong_student_is_rejected`
— once it starts passing, that's your confirmation the fix landed.

### Explanation (`/explanation`)

| Method | Path |
|---|---|
| GET | `/explanation/{session_id}/{student_id}` |

AI-generated per-question explanations for a completed session. Same
ownership-check gap as `/results/session` is worth probing here too.

### Progress (`/progress`)

| Method | Path |
|---|---|
| GET | `/progress/{student_id}` |
| GET | `/progress/{student_id}/{subtopic_id}` |

### Behaviour (`/behaviour`)

| Method | Path | Body |
|---|---|---|
| POST | `/behaviour/save-snapshot` | `BehaviourSnapshotRequest` |
| POST | `/behaviour/save-summary` | `BehaviourSummaryRequest` |
| GET | `/behaviour/session/{session_id}` | none |
| GET | `/behaviour/student/{student_id}` | none |

Percent fields (`phone_percent`, `drowsy_percent`, etc.) sent in
`save-summary` are **advisory only** — the server recomputes them from the
stored per-snapshot flags, so it's a good place to test "does the client
value actually get trusted" (it shouldn't).

### Settings (`/settings`)

| Method | Path | Body |
|---|---|---|
| PUT | `/settings/{student_id}/availability` | `UpdateAvailabilityRequest` |
| POST | `/settings/{student_id}/next-free` | `NextFreeCheckInRequest` |

```bash
curl -s -X PUT "$BASE_URL/settings/42/availability" \
  -H "Content-Type: application/json" \
  -d '{
    "free_days": [1, 3, 5],
    "session_length": "medium",
    "day_session_length": {},
    "email_reminders_enabled": true
  }'
```

`next-free`'s `choice` field is a `Literal["tomorrow", "in_2_days", "this_weekend", "not_sure"]`
— a good target for enum-boundary negative testing (send `"next week"` and
confirm `422`).

### Teacher (`/teacher`)

| Method | Path | Body |
|---|---|---|
| POST | `/teacher/{student_id}/chat` | `TeacherChatRequest` |
| GET | `/teacher/{student_id}/report` | none |

AI-backed chat; `message` plus optional `history` (oldest-first). Good
target for exploratory testing — very long messages, empty strings, and
non-English input are all reasonable charter items (see
[exploratory-charter.md](manual-testing/exploratory-charter.md)).

### Admin (`/admin`) — the one route group with real auth enforcement

| Method | Path | Auth |
|---|---|---|
| GET | `/admin/students` | `require_admin` |
| GET | `/admin/students/{student_id}` | `require_admin` |
| PATCH | `/admin/students/{student_id}/role` | `require_admin`, body `{"role": "student" \| "admin"}` |

```bash
# 401 — no token at all
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/admin/students"

# 403 — valid demo token, but that email's role isn't "admin" in the DB
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/admin/students" \
  -H "Authorization: Bearer demo:Not Admin:not-admin@edufx.demo"

# 200 — only if this exact email's students.role = 'admin'
curl -s "$BASE_URL/admin/students" \
  -H "Authorization: Bearer demo:Real Admin:your-real-admin-email@example.com"
```

`role` in `PATCH .../role` is a strict `Literal["student", "admin"]` —
sending any other string is a `422` from Pydantic before it reaches the
service, but only *after* the `require_admin` auth check runs (auth is
checked first regardless of body validity — confirm this ordering yourself,
it's a common thing to get backwards).

### Internal (`/internal`)

| Method | Path | Auth |
|---|---|---|
| POST | `/internal/reminders/run` | `X-Internal-Secret` header, if `REMINDERS_SHARED_SECRET` is set |

Triggers the daily reminder-email scan; called by the `reminders.yml`
scheduled GitHub Action, not by the frontend. Locally, with no secret
configured, this route has **no auth at all** — worth explicitly confirming
this is never true in the deployed environment (`REMINDERS_SHARED_SECRET`
should always be set in production; if it isn't, this is a real finding).

## 4. Manual Test Case Matrix

| ID | Endpoint | Scenario | Expected |
|---|---|---|---|
| TC_API_AUTH_01 | `POST /auth/google` | Valid demo token, new email | `200`, student created |
| TC_API_AUTH_02 | `POST /auth/google` | Same demo token twice | `200`, same `student_id` both times |
| TC_API_AUTH_03 | `POST /auth/google` | No `Authorization` header | `401` |
| TC_API_DIAG_01 | `POST /diagnostic/submit` | All 40 answers, all correct | `200`, 10 results, each `assigned_level` reflects score |
| TC_API_DIAG_02 | `POST /diagnostic/submit` | 39 answers (one missing) | `422` |
| TC_API_QUIZ_01 | `GET /quiz/{id}/{student}` | First visit, diagnostic done | `200`, `stage: "first"`, 15 questions |
| TC_API_QUIZ_02 | `GET /quiz/{id}/{student}` | Second visit, after a submitted attempt | `200`, `stage: "personalized"`, `source: "live-gen"` |
| TC_API_QUIZ_03 | `GET /quiz/{bad_id}/{student}` | Subtopic id that doesn't exist | `404` |
| TC_API_RESULTS_01 | `POST /results/submit-quiz` | All correct answers | `200`, `quiz_score: 100`, `level_changed` reflects rule |
| TC_API_RESULTS_02 | `GET /results/session/{id}/{other_student}` | Real session, wrong `student_id` | **Should** `403`/`404` — currently doesn't, see [BUG_RESULTS_002](bug-report-samples.md#bug_results_002) |
| TC_API_ADMIN_01 | `GET /admin/students` | No token | `401` |
| TC_API_ADMIN_02 | `GET /admin/students` | Non-admin token | `403` |
| TC_API_ADMIN_03 | `PATCH /admin/students/{id}/role` | Non-admin token, `{"role":"admin"}` | `403` (self-promotion blocked) |
| TC_API_ADMIN_04 | `PATCH /admin/students/{id}/role` | Admin token, invalid role string | `422` |
| TC_API_SETTINGS_01 | `PUT /settings/{id}/availability` | `free_days: [1,3,5]` | `200`, echoed back on next `/auth/check` |
| TC_API_SETTINGS_02 | `POST /settings/{id}/next-free` | `choice: "next week"` (not a valid enum value) | `422` |

## 5. Negative & Security Test Ideas

Beyond the [generic API testing checklist](api-testing-checklist.md), these
are specific to how this backend is built:

- **Path-param trust**: nearly every non-admin route trusts `student_id` in
  the URL path directly, without deriving it from the auth token. Test what
  happens when you pass a `student_id` that belongs to someone else on
  every route that takes one as a path param — `/progress`, `/results`,
  `/explanation`, `/behaviour`, `/settings`, `/teacher`. This is the same
  class of bug as [BUG_RESULTS_002](bug-report-samples.md#bug_results_002);
  finding more instances of it is genuinely useful testing, not busywork.
- **Validation-order testing**: as shown with `/content`'s adaptive gate
  running before the existence check, don't assume "invalid resource ID"
  always means "404" — verify the *actual* precedence of checks per route.
- **Enum boundaries**: every `Literal[...]` field in `dto.py` (session
  length, next-free choice, self-assessment rating, admin role) is worth a
  dedicated "send something outside the enum" test.
- **Diagnostic completeness**: the 40-answer requirement is a strict count
  check, not per-question validation — confirm duplicate `question_id`s or
  answers for the wrong `subtopic_id` don't silently pass.
- **Idempotency**: does `POST /auth/google` with the same demo email twice
  create two students, or reuse the first? (Should reuse — confirmed above,
  worth re-verifying after any auth-layer change.)

## 6. Environment Guidance — what is and isn't safe to test against

- **Local** (`memory` data backend, default): fully disposable, resets on
  restart. Best for anything destructive or repetitive.
- **Local against Supabase** (`DATA_BACKEND=supabase` in `.env`): writes
  real rows to the shared dev database. Use clearly-tagged emails
  (`qa-tester-*@edufx.demo`) so real accounts aren't confused with test data.
- **Deployed Cloud Run backend**: same live Supabase project as production.
  Only use `demo:` emails prefixed distinctly (e.g. `qa-*@edufx.demo`) and
  never target real user emails or real student IDs you don't own — this is
  a live system with real (if small-scale) usage.
- **Never** use this guide's examples against a system you don't have
  authorization to test.

## 7. Known Gaps Worth Testing For

This list exists so testing effort finds *real, already-suspected* issues
first rather than starting from zero:

1. **Session/resource ownership isn't consistently enforced** — see
   `BUG_RESULTS_002` above. Likely affects `/explanation` too; worth
   confirming which other routes share the pattern.
2. **`/internal/reminders/run` has no auth if `REMINDERS_SHARED_SECRET` is
   unset** — confirm this env var is actually set in the deployed
   environment (it should be a GitHub Actions secret, not something a
   tester can check via the API itself, but it's worth flagging as a
   deployment-config check rather than pure API testing).
3. **Cold-start latency** on Cloud Run (scale-to-zero) can make the first
   request after idle noticeably slow — this is expected, not a bug, but
   worth having a documented performance-smoke threshold for (see
   [api-testing-checklist.md](api-testing-checklist.md)) so it isn't
   mistaken for a timeout defect.
