"""Tests for Google Sign-In verification and login matching."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from coinco_rep.auth.google import GoogleAuthError, verify_google_id_token
from coinco_rep.config import settings
from coinco_rep.main import app


class TestVerifyGoogleIdToken:
    def test_missing_client_id(self):
        with patch.object(settings, "google_client_id", ""):
            with pytest.raises(GoogleAuthError, match="not configured"):
                verify_google_id_token("tok")

    def test_empty_credential(self):
        with patch.object(settings, "google_client_id", "client.apps.googleusercontent.com"):
            with pytest.raises(GoogleAuthError, match="Missing"):
                verify_google_id_token("  ")

    def test_invalid_token(self):
        with patch.object(settings, "google_client_id", "client.apps.googleusercontent.com"):
            with patch(
                "coinco_rep.auth.google.id_token.verify_oauth2_token",
                side_effect=ValueError("bad"),
            ):
                with pytest.raises(GoogleAuthError, match="Invalid"):
                    verify_google_id_token("bad.token")

    def test_unverified_email(self):
        with patch.object(settings, "google_client_id", "client.apps.googleusercontent.com"):
            with patch(
                "coinco_rep.auth.google.id_token.verify_oauth2_token",
                return_value={
                    "iss": "https://accounts.google.com",
                    "sub": "g1",
                    "email": "a@gmail.com",
                    "email_verified": False,
                },
            ):
                with pytest.raises(GoogleAuthError, match="not verified"):
                    verify_google_id_token("ok.token")

    def test_success_normalizes_email(self):
        with patch.object(settings, "google_client_id", "client.apps.googleusercontent.com"):
            with patch(
                "coinco_rep.auth.google.id_token.verify_oauth2_token",
                return_value={
                    "iss": "accounts.google.com",
                    "sub": "g1",
                    "email": "  Ana@Gmail.com ",
                    "email_verified": True,
                    "name": "Ana",
                },
            ):
                claims = verify_google_id_token("ok.token")
                assert claims["email"] == "ana@gmail.com"
                assert claims["sub"] == "g1"
                assert claims["name"] == "Ana"


class TestGoogleLoginRoute:
    def test_providers_disabled_without_client_id(self):
        with patch.object(settings, "google_client_id", ""):
            client = TestClient(app)
            res = client.get("/api/v1/auth/providers")
            assert res.status_code == 200
            assert res.json() == {"google": {"enabled": False, "client_id": None}}

    def test_providers_enabled(self):
        with patch.object(settings, "google_client_id", "abc.apps.googleusercontent.com"):
            client = TestClient(app)
            res = client.get("/api/v1/auth/providers")
            assert res.status_code == 200
            body = res.json()
            assert body["google"]["enabled"] is True
            assert body["google"]["client_id"] == "abc.apps.googleusercontent.com"

    def test_google_login_links_by_email(self):
        person = {
            "id": "p1",
            "name": "Ana",
            "color": "blue",
            "email": "ana@gmail.com",
            "google_sub": None,
            "pin_hash": "x",
        }
        linked = {**person, "google_sub": "sub-1"}

        with (
            patch.object(settings, "google_client_id", "client.apps.googleusercontent.com"),
            patch.object(settings, "household_id", "hh-1"),
            patch(
                "coinco_rep.api.routes.auth.verify_google_id_token",
                return_value={"sub": "sub-1", "email": "ana@gmail.com", "name": "Ana"},
            ),
            patch(
                "coinco_rep.api.routes.auth.people_repo.get_person_by_google_sub",
                return_value=None,
            ),
            patch(
                "coinco_rep.api.routes.auth.people_repo.get_person_by_email",
                return_value=person,
            ),
            patch(
                "coinco_rep.api.routes.auth.people_repo.update_person",
                return_value=linked,
            ) as update,
        ):
            client = TestClient(app)
            res = client.post("/api/v1/auth/google", json={"credential": "tok"})
            assert res.status_code == 200
            assert res.json() == {"id": "p1", "name": "Ana", "color": "blue"}
            assert "session" in res.cookies
            update.assert_called_once_with("p1", "hh-1", google_sub="sub-1")

    def test_google_login_unknown_email(self):
        with (
            patch.object(settings, "google_client_id", "client.apps.googleusercontent.com"),
            patch.object(settings, "household_id", "hh-1"),
            patch(
                "coinco_rep.api.routes.auth.verify_google_id_token",
                return_value={"sub": "sub-1", "email": "otro@gmail.com", "name": "Otro"},
            ),
            patch(
                "coinco_rep.api.routes.auth.people_repo.get_person_by_google_sub",
                return_value=None,
            ),
            patch(
                "coinco_rep.api.routes.auth.people_repo.get_person_by_email",
                return_value=None,
            ),
        ):
            client = TestClient(app)
            res = client.post("/api/v1/auth/google", json={"credential": "tok"})
            assert res.status_code == 401
            assert "Gmail" in res.json()["detail"]
