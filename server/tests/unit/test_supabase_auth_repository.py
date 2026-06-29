from datetime import UTC, datetime
from unittest.mock import Mock

import httpx
import pytest

from app.models.domain import Student
from app.repositories.supabase_auth_repository import SupabaseAuthRepository


class _InsertConflictQuery:
    def execute(self):
        request = httpx.Request("POST", "https://example.supabase.co/rest/v1/students")
        response = httpx.Response(409, request=request)
        raise httpx.HTTPStatusError("conflict", request=request, response=response)


class _InsertServerErrorQuery:
    def execute(self):
        request = httpx.Request("POST", "https://example.supabase.co/rest/v1/students")
        response = httpx.Response(500, request=request)
        raise httpx.HTTPStatusError("server error", request=request, response=response)


class _Client:
    def __init__(self, query):
        self.query = query

    def table(self, name: str):
        assert name == "students"
        return self

    def insert(self, _payload):
        return self.query


def test_create_student_returns_existing_student_after_conflict():
    existing = Student(
        id=7,
        name="Existing Student",
        email="existing@edufx.dev",
        diagnostic_completed=False,
        created_at=datetime.now(UTC),
    )
    repository = SupabaseAuthRepository(_Client(_InsertConflictQuery()))
    repository.find_student_by_email = Mock(return_value=existing)
    repository.mapper = Mock()

    student = repository.create_student("Existing Student", "existing@edufx.dev")

    assert student == existing
    repository.find_student_by_email.assert_called_once_with("existing@edufx.dev")
    repository.mapper.ensure_progress_records.assert_called_once_with(existing.id)


def test_create_student_reraises_non_conflict_http_errors():
    repository = SupabaseAuthRepository(_Client(_InsertServerErrorQuery()))
    repository.mapper = Mock()

    with pytest.raises(httpx.HTTPStatusError):
        repository.create_student("Broken Student", "broken@edufx.dev")
