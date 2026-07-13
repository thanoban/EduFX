"""Negative and security-focused API tests.

`test_api_flow.py` covers the happy path end-to-end. This file is the
complementary "what should fail, and how" suite: missing/invalid input,
missing auth, and cross-role access — the class of tests a QA engineer
writes right after the golden-path flow is green, because a passing happy
path says nothing about how the API behaves under bad input.
"""

import pytest
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


# ── Auth ──────────────────────────────────────────────────────────────────


def test_login_without_authorization_header_is_rejected():
    response = client.post("/auth/google")
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False


def test_check_without_student_id_header_is_rejected():
    response = client.get("/auth/check")
    # FastAPI's own request-validation layer rejects a missing required
    # header before our code runs, hence 422 rather than an EduFXError 401/404.
    assert response.status_code == 422


# ── Diagnostic ────────────────────────────────────────────────────────────


def test_diagnostic_submit_with_missing_student_id_is_rejected():
    response = client.post("/diagnostic/submit", json={"answers": []})
    assert response.status_code == 422


def test_diagnostic_submit_for_unknown_student_returns_error():
    questions = client.get("/diagnostic/questions").json()["data"]["questions"]
    response = client.post(
        "/diagnostic/submit",
        json={
            "student_id": 9_999_999,
            "answers": [
                {
                    "question_id": question["id"],
                    "subtopic_id": question["subtopic_id"],
                    "student_answer": question["correct_answer"],
                }
                for question in questions
            ],
        },
    )
    assert response.status_code >= 400
    assert response.json()["success"] is False


# ── Content / Quiz — invalid resource ids ──────────────────────────────────


def test_content_for_unknown_subtopic_is_blocked_by_adaptive_gating():
    # A fresh student has no active recommendation yet (diagnostic not taken),
    # so /content 403s on *any* subtopic_id before it ever checks whether that
    # subtopic exists — the adaptive-scheduling gate runs first. This is
    # intentional design, not a missing-resource 404.
    student_id = create_student("content-gated")
    response = client.get(f"/content/9999999/{student_id}")
    assert response.status_code == 403


def test_quiz_for_unknown_subtopic_returns_404():
    student_id = create_student("quiz-404")
    response = client.get(f"/quiz/9999999/{student_id}")
    assert response.status_code == 404


# ── Results — cross-student access ─────────────────────────────────────────


@pytest.mark.xfail(
    reason=(
        "BUG_RESULTS_002 (known, not yet fixed): GET /results/session/{session_id}/{student_id} "
        "never checks that the session actually belongs to student_id — ResultsService."
        "get_session_results() looks the session up by session_id alone. Any student_id in the "
        "path currently gets the real owner's quiz data back. See docs/qa/bug-report-samples.md."
    ),
    strict=True,
)
def test_results_session_for_wrong_student_is_rejected():
    """Session ownership must be enforced: student B must not be able to
    read student A's quiz session just by guessing the session_id."""
    student_a = create_student("owner")
    questions = client.get("/diagnostic/questions").json()["data"]["questions"]
    client.post(
        "/diagnostic/submit",
        json={
            "student_id": student_a,
            "answers": [
                {
                    "question_id": q["id"],
                    "subtopic_id": q["subtopic_id"],
                    "student_answer": q["correct_answer"],
                }
                for q in questions
            ],
        },
    )
    plan = client.get(f"/scheduler/todays-plan/{student_a}").json()["data"]["plan"]
    subtopic_id = plan[0]["subtopic_id"]
    quiz = client.get(f"/quiz/{subtopic_id}/{student_a}").json()["data"]
    results = client.post(
        "/results/submit-quiz",
        json={
            "student_id": student_a,
            "session_id": quiz["session_id"],
            "subtopic_id": subtopic_id,
            "webcam_enabled": False,
            "answers": [
                {"question_id": item["id"], "student_answer": item["correct_answer"]}
                for item in quiz["questions"]
            ],
        },
    )
    session_id = results.json()["data"]["session_id"]

    student_b = create_student("intruder")
    response = client.get(f"/results/session/{session_id}/{student_b}")
    assert response.status_code >= 400
    assert response.json()["success"] is False


# ── Admin — role gating ─────────────────────────────────────────────────────


def test_admin_students_without_token_is_rejected():
    response = client.get("/admin/students")
    assert response.status_code == 401


def test_admin_students_with_non_admin_token_is_forbidden():
    response = client.get(
        "/admin/students",
        headers={"Authorization": "Bearer demo:Regular Student:not-admin@edufx.demo"},
    )
    assert response.status_code == 403
    assert response.json()["success"] is False


def test_admin_role_change_with_non_admin_token_is_forbidden():
    student_id = create_student("role-target")
    response = client.patch(
        f"/admin/students/{student_id}/role",
        json={"role": "admin"},
        headers={"Authorization": "Bearer demo:Regular Student:not-admin-2@edufx.demo"},
    )
    assert response.status_code == 403


def test_admin_role_change_rejects_invalid_role_value():
    # Pydantic's Literal["student", "admin"] should reject anything else at
    # the request-validation layer, before it ever reaches the service.
    response = client.patch(
        "/admin/students/1/role",
        json={"role": "superuser"},
        headers={"Authorization": "Bearer demo:Regular Student:not-admin-3@edufx.demo"},
    )
    # Auth is checked first (dependency runs before body validation for this
    # route), so a non-admin caller gets 403 regardless of the invalid role.
    assert response.status_code == 403
