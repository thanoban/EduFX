from types import SimpleNamespace

import pytest

from app.core.errors import EduFXError
from app.routes import internal


def test_internal_secret_allows_local_dev_when_unset(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        internal,
        "get_settings",
        lambda: SimpleNamespace(reminders_shared_secret=None),
    )

    assert internal.require_internal_secret(None) is None


def test_internal_secret_rejects_wrong_secret(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        internal,
        "get_settings",
        lambda: SimpleNamespace(reminders_shared_secret="expected"),
    )

    with pytest.raises(EduFXError, match="Invalid internal secret"):
        internal.require_internal_secret("wrong")


def test_internal_secret_accepts_matching_secret(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        internal,
        "get_settings",
        lambda: SimpleNamespace(reminders_shared_secret="expected"),
    )

    assert internal.require_internal_secret("expected") is None
