from app.core.email import send_email


def test_send_email_noop_path_is_safe_without_api_key(caplog):
    # Local/test env never has RESEND_API_KEY set, so this must log instead of
    # making a real network call, and still report success.
    with caplog.at_level("INFO", logger="edufx.email"):
        result = send_email("student@example.com", "Subject", "Body")
    assert result is True
    assert any("email:noop" in message for message in caplog.messages)
