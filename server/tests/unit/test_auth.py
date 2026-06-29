from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from app.core import auth
from app.core.auth import verify_google_token
from app.core.errors import EduFXError


class _Settings:
    def __init__(self, supabase_url=None, supabase_jwt_secret=None):
        self.supabase_url = supabase_url
        self.supabase_jwt_secret = supabase_jwt_secret


def test_demo_token_resolves_without_verification():
    identity = verify_google_token("demo:Ada Lovelace:ada@edufx.demo")
    assert identity.email == "ada@edufx.demo"
    assert identity.name == "Ada Lovelace"


def test_hs256_token_is_verified_with_shared_secret():
    secret = "super-secret"
    token = jwt.encode({"email": "h@edufx.dev", "sub": "u1"}, secret, algorithm="HS256")
    with patch.object(auth, "get_settings", return_value=_Settings(supabase_jwt_secret=secret)):
        identity = verify_google_token(token)
    assert identity.email == "h@edufx.dev"
    assert identity.subject == "u1"


def test_hs256_token_with_wrong_secret_is_rejected():
    token = jwt.encode({"email": "h@edufx.dev"}, "right", algorithm="HS256")
    with patch.object(auth, "get_settings", return_value=_Settings(supabase_jwt_secret="wrong")):
        with pytest.raises(EduFXError):
            verify_google_token(token)


def test_es256_token_is_verified_against_jwks():
    # This is the regression case: Supabase "JWT Signing Keys" issue ES256 tokens
    # that the old HS256-only path rejected with "alg value is not allowed".
    private_key = ec.generate_private_key(ec.SECP256R1())
    token = jwt.encode(
        {"email": "es@edufx.dev", "sub": "u2", "name": "Es User"},
        private_key,
        algorithm="ES256",
    )

    class _SigningKey:
        key = private_key.public_key()

    class _Client:
        def get_signing_key_from_jwt(self, _token):
            return _SigningKey()

    settings = _Settings(supabase_url="https://example.supabase.co")
    with patch.object(auth, "get_settings", return_value=settings), patch.object(
        auth, "_jwks_client", return_value=_Client()
    ):
        identity = verify_google_token(token)
    assert identity.email == "es@edufx.dev"
    assert identity.name == "Es User"
