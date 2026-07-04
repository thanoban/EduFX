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


def test_auth_and_diagnostic_flow():
    student_id = create_student("diag")
    questions = client.get("/diagnostic/questions").json()["data"]["questions"]
    payload = {
        "student_id": student_id,
        "answers": [
            {
                "question_id": question["id"],
                "subtopic_id": question["subtopic_id"],
                "student_answer": question["correct_answer"],
            }
            for question in questions
        ],
    }
    response = client.post("/diagnostic/submit", json=payload)
    assert response.status_code == 200
    assert len(response.json()["data"]["results"]) == 10


def test_diagnostic_rejects_incomplete_submission():
    student_id = create_student("incomplete")
    questions = client.get("/diagnostic/questions").json()["data"]["questions"]
    response = client.post(
        "/diagnostic/submit",
        json={
            "student_id": student_id,
            "answers": [
                {
                    "question_id": question["id"],
                    "subtopic_id": question["subtopic_id"],
                    "student_answer": question["correct_answer"],
                }
                for question in questions[:39]
            ],
        },
    )
    assert response.status_code == 422
    assert response.json()["success"] is False


def test_scheduler_content_quiz_results_and_progress_flow():
    student_id = create_student("flow")
    questions = client.get("/diagnostic/questions").json()["data"]["questions"]
    client.post(
        "/diagnostic/submit",
        json={
            "student_id": student_id,
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

    plan = client.get(f"/scheduler/todays-plan/{student_id}").json()["data"]["plan"]
    assert len(plan) == 3
    subtopic_id = plan[0]["subtopic_id"]

    content = client.get(f"/content/{subtopic_id}/{student_id}")
    assert content.status_code == 200

    quiz = client.get(f"/quiz/{subtopic_id}/{student_id}").json()["data"]
    assert quiz["stage"] == "first"
    answers = [
        {"question_id": item["id"], "student_answer": item["correct_answer"]}
        for item in quiz["questions"]
    ]

    client.post(
        "/behaviour/save-summary",
        json={
            "student_id": student_id,
            "session_id": quiz["session_id"],
            "subtopic_id": subtopic_id,
            "webcam_enabled": True,
            "phone_percent": 0,
            "drowsy_percent": 0,
            "away_percent": 0,
            "talking_percent": 0,
            "absent_percent": 0,
            "focus_score": 92,
        },
    )

    results = client.post(
        "/results/submit-quiz",
        json={
            "student_id": student_id,
            "session_id": quiz["session_id"],
            "subtopic_id": subtopic_id,
            "webcam_enabled": True,
            "answers": answers,
        },
    )
    assert results.status_code == 200
    session_id = results.json()["data"]["session_id"]

    session = client.get(f"/results/session/{session_id}/{student_id}")
    assert session.status_code == 200
    assert session.json()["data"]["quiz_score"] == 100

    explanations = client.get(f"/explanation/{session_id}/{student_id}")
    assert explanations.status_code == 200

    progress = client.get(f"/progress/{student_id}")
    assert progress.status_code == 200

    history = client.get(f"/behaviour/student/{student_id}")
    assert history.status_code == 200


def test_repeat_quiz_triggers_personalized_generation():
    student_id = create_student("repeat")
    questions = client.get("/diagnostic/questions").json()["data"]["questions"]
    client.post(
        "/diagnostic/submit",
        json={
            "student_id": student_id,
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
    subtopic_id = 1
    first_quiz = client.get(f"/quiz/{subtopic_id}/{student_id}").json()["data"]
    client.post(
        "/results/submit-quiz",
        json={
            "student_id": student_id,
            "session_id": first_quiz["session_id"],
            "subtopic_id": subtopic_id,
            "webcam_enabled": False,
            "answers": [
                {"question_id": item["id"], "student_answer": item["correct_answer"]}
                for item in first_quiz["questions"]
            ],
        },
    )

    repeat_quiz = client.get(f"/quiz/{subtopic_id}/{student_id}")
    assert repeat_quiz.status_code == 200
    assert repeat_quiz.json()["data"]["stage"] == "personalized"
    assert all(item["source"] == "live-gen" for item in repeat_quiz.json()["data"]["questions"])
