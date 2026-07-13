# EduFX Automated API Testing Guide

How this project's automated test suite is built, how to run it, and how to
extend it. For the manual/exploratory counterpart, see
[api-testing-guide.md](api-testing-guide.md).

## 1. Stack

| Layer | Tool | Where |
|---|---|---|
| Backend unit tests | `pytest` | `server/tests/unit/*.py` (~24 files) |
| Backend API integration tests | `pytest` + FastAPI `TestClient` | `server/tests/integration/*.py` |
| Frontend component/unit tests | `vitest` + `@testing-library/react` | `client/src/**/*.test.ts(x)` |

The integration tests are the ones most relevant to "API testing" — they run
**the real FastAPI app in-process**, sending real HTTP requests through the
real routing/validation/auth layers, but without a network socket or a
running server. This is the standard way to automate API testing for a
FastAPI backend: fast (no process startup), but exercises the actual HTTP
contract (status codes, JSON shape, header handling), unlike a plain
unit test that calls a service function directly in Python.

## 2. Running the suite

```bash
cd server
pip install -r requirements.txt
python -m pytest tests/ -v                       # everything
python -m pytest tests/integration/ -v            # API-level tests only
python -m pytest tests/unit/ -v                   # service/repository-level tests only
python -m pytest tests/integration/test_api_flow.py -v   # one file
python -m pytest -k "admin" -v                    # anything with "admin" in the test name
```

```bash
cd client
npm install
npx vitest run             # everything, once
npx vitest                 # watch mode
npx vitest run src/features/auth  # one folder
```

`server/tests/conftest.py` forces `DATA_BACKEND=memory` and blanks out any
Supabase/GCP env vars before the app is imported, so **running the suite
never touches real data**, regardless of what's in your local `.env`. This
is the single most important property of this test suite — it's why it's
safe to run repeatedly without worrying about polluting the live Supabase
project the way ad-hoc manual `curl` testing can.

## 3. How the existing suite is structured

### `tests/integration/test_api_flow.py` — the golden path

One `TestClient(app)` instance shared across the file, a `create_student()`
helper that logs in via the `demo:` token trick (see
[api-testing-guide.md §2](api-testing-guide.md#2-authentication--the-demo-token-trick)),
then four tests that walk the **entire real user journey** end-to-end over
real HTTP calls: login → diagnostic → scheduler → content → quiz → behaviour
→ results → explanation → progress. This is a genuine regression safety net
— if any of those nine endpoints break in a way that stops the flow from
completing, this file catches it immediately.

### `tests/integration/test_api_negative_cases.py` — what should fail

The complementary suite: missing auth, missing required fields, invalid
resource IDs, cross-role access, and (see below) a documented known bug.
Written after the happy path was already green — this is the normal QA
order: prove the golden path works, *then* go looking for what breaks it.

Notable pattern used here — **`pytest.mark.xfail` for a known, unfixed
bug**:

```python
@pytest.mark.xfail(
    reason="BUG_RESULTS_002 (known, not yet fixed): ...",
    strict=True,
)
def test_results_session_for_wrong_student_is_rejected():
    ...
```

`xfail` documents "this should pass, currently doesn't, here's why" directly
in the test suite instead of just in a bug tracker — the test still runs
every time CI runs, so if someone accidentally fixes the underlying bug as a
side effect of unrelated work, `strict=True` makes the suite **fail** (not
silently pass) until the `xfail` marker itself is removed, which forces a
deliberate acknowledgement that the bug is fixed rather than a fix going
unnoticed. This is a real technique worth using any time you find a bug
you're choosing not to fix in the same session that found it.

### `tests/unit/*.py` — service and repository logic

Each file targets one service or repository in isolation (constructed
directly in Python, no HTTP layer, often against `DemoDataStore` fixtures
or hand-built domain objects) — e.g. `test_admin_service.py`,
`test_rules.py` (the pure scheduling-priority math), `test_ai_service.py`
(provider fallback chain behavior with mocked clients). These are faster
and more precise for testing business logic edge cases than going through
HTTP every time; the integration tests exist to prove the HTTP layer wires
those services together correctly, not to re-test every logic branch.

**Rule of thumb**: if you're testing "does this calculation/rule produce
the right answer," write a unit test. If you're testing "does the API
return the right status code/shape/auth behavior," write an integration
test.

## 4. Writing a new automated API test

Copy the pattern from `test_api_negative_cases.py`:

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def create_student(suffix: str = "default") -> int:
    response = client.post(
        "/auth/google",
        headers={"Authorization": f"Bearer demo:Test User:test-{suffix}@edufx.demo"},
    )
    assert response.status_code == 200
    return response.json()["data"]["student_id"]


def test_my_new_scenario():
    student_id = create_student("my-scenario")           # unique suffix — avoids
                                                            # colliding with other tests'
                                                            # data in the shared in-process store
    response = client.get(f"/progress/{student_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"] == []                             # fresh student, no progress yet
```

**Things that trip people up the first time:**

- The in-memory `DemoDataStore` is **shared across every test in the same
  pytest process** (it's built once via `get_container()`, which is
  `@lru_cache`d). Student IDs keep incrementing across the whole test run —
  don't assume a fresh student is `student_id == 1`, and always use a
  unique `suffix` per test so `create_student()` calls don't collide.
- `TestClient` re-raises unhandled server-side exceptions into the test
  itself by default (`raise_server_exceptions=True`), rather than returning
  the 500 JSON response a real deployed server would send. This is
  *useful* — it's exactly how `test_api_negative_cases.py` first caught
  the `KeyError` bug in `QuizRepository.get_progress()` for an unknown
  `subtopic_id` (now fixed) — but it means "does this crash" and "does
  this return the JSON 500 body" are different things to test for if you
  specifically care about the latter.
- Prefer asserting on `response.json()["data"]` fields over the full
  response body where practical — DTOs gain optional fields over time, and
  asserting the whole body makes tests brittle for unrelated reasons.

## 5. CI

`.github/workflows/test.yml` runs the full backend `pytest` suite and the
frontend `vitest` suite on every push and pull request (added alongside this
guide — see the workflow file for the exact steps). This is separate from
`.github/workflows/deploy.yml`, which builds and deploys to Cloud Run but
does **not** gate on tests passing first — `test.yml` is the actual quality
gate; treat a red run there as blocking, the same as you would a failed
manual smoke test before a release.

## 6. Automation Coverage Matrix

| Endpoint group | Covered by |
|---|---|
| `/auth/*` | `test_api_flow.py`, `test_api_negative_cases.py` |
| `/diagnostic/*` | `test_api_flow.py`, `test_api_negative_cases.py` |
| `/scheduler/*` | `test_api_flow.py` |
| `/content/*` | `test_api_flow.py`, `test_api_negative_cases.py` |
| `/quiz/*` | `test_api_flow.py`, `test_api_negative_cases.py` |
| `/results/*` | `test_api_flow.py`, `test_api_negative_cases.py` (incl. one `xfail`) |
| `/explanation/*` | `test_api_flow.py` |
| `/progress/*` | `test_api_flow.py` |
| `/behaviour/*` | `test_api_flow.py` |
| `/admin/*` | `test_api_negative_cases.py` (auth gating only — no positive-path test yet, since the memory backend's "first student is admin" bootstrap rule is order-dependent across a shared test run and isn't a safe thing to assert on; see `AdminRepository`/`DemoDataStore.create_student`) |
| `/settings/*` | **Not yet covered** — good first contribution |
| `/teacher/*` | **Not yet covered** — good first contribution (mock the AI provider call, don't hit a real LLM in tests) |
| `/internal/*` | **Not yet covered** — good first contribution |

The three "not yet covered" rows are a reasonable next-work list if you're
using this project to build up a QA automation portfolio incrementally.
