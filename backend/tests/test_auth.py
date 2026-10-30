import json
import logging
import unittest
from http import HTTPStatus
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from app import create_app
from app.auth import (
    AuthenticationUnavailable,
    InvalidAccessToken,
    MAX_AUTH_RESPONSE_BYTES,
    require_staff_access,
    verify_supabase_access_token,
)


SYNTHETIC_TOKEN = "synthetic.header.signature"
SYNTHETIC_USER_ID = "00000000-0000-4000-8000-000000000001"


class FakeResponse:
    def __init__(self, body, status=HTTPStatus.OK):
        self.body = body
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *args):
        del args
        return None

    def getcode(self):
        return self.status

    def read(self, size=-1):
        return self.body[:size]


class SupabaseTokenVerificationTests(unittest.TestCase):
    def test_sends_token_and_public_key_only_to_auth_user_endpoint(self):
        response_body = json.dumps({"id": SYNTHETIC_USER_ID}).encode()
        with patch(
            "app.auth._open_auth_request",
            return_value=FakeResponse(response_body),
        ) as open_request:
            user_id = verify_supabase_access_token(
                SYNTHETIC_TOKEN,
                supabase_url="https://project.supabase.co",
                anon_key="synthetic-public-key",
                timeout=3,
            )

        self.assertEqual(user_id, SYNTHETIC_USER_ID)
        auth_request, timeout = open_request.call_args.args
        self.assertEqual(auth_request.full_url, "https://project.supabase.co/auth/v1/user")
        self.assertEqual(timeout, 3)
        self.assertEqual(
            auth_request.get_header("Authorization"),
            f"Bearer {SYNTHETIC_TOKEN}",
        )
        self.assertEqual(
            auth_request.get_header("Apikey"),
            "synthetic-public-key",
        )

    def test_rejects_token_supabase_reports_as_invalid_or_expired(self):
        error = HTTPError(
            "https://project.supabase.co/auth/v1/user",
            HTTPStatus.UNAUTHORIZED,
            "rejected",
            {},
            None,
        )
        with patch("app.auth._open_auth_request", side_effect=error):
            with self.assertRaises(InvalidAccessToken):
                verify_supabase_access_token(
                    SYNTHETIC_TOKEN,
                    supabase_url="https://project.supabase.co",
                    anon_key="synthetic-public-key",
                    timeout=3,
                )

    def test_treats_other_upstream_statuses_as_unavailable(self):
        error = HTTPError(
            "https://project.supabase.co/auth/v1/user",
            HTTPStatus.SERVICE_UNAVAILABLE,
            "unavailable",
            {},
            None,
        )
        with patch("app.auth._open_auth_request", side_effect=error):
            with self.assertRaises(AuthenticationUnavailable):
                verify_supabase_access_token(
                    SYNTHETIC_TOKEN,
                    supabase_url="https://project.supabase.co",
                    anon_key="synthetic-public-key",
                    timeout=3,
                )

    def test_bounds_and_validates_upstream_response(self):
        cases = (
            b"not-json",
            b'{"email":"person@example.invalid"}',
            b'{"id":""}',
            b" " * (MAX_AUTH_RESPONSE_BYTES + 1),
        )
        for body in cases:
            with self.subTest(body_length=len(body)):
                with patch(
                    "app.auth._open_auth_request",
                    return_value=FakeResponse(body),
                ):
                    with self.assertRaises(AuthenticationUnavailable):
                        verify_supabase_access_token(
                            SYNTHETIC_TOKEN,
                            supabase_url="https://project.supabase.co",
                            anon_key="synthetic-public-key",
                            timeout=3,
                        )

    def test_rejects_non_uuid_identity_from_upstream(self):
        with patch(
            "app.auth._open_auth_request",
            return_value=FakeResponse(b'{"id":"not-a-uuid"}'),
        ):
            with self.assertRaises(AuthenticationUnavailable):
                verify_supabase_access_token(
                    SYNTHETIC_TOKEN,
                    supabase_url="https://project.supabase.co",
                    anon_key="synthetic-public-key",
                    timeout=3,
                )

    def test_treats_timeout_as_unavailable_without_echoing_details(self):
        with patch(
            "app.auth._open_auth_request",
            side_effect=URLError(f"timeout token={SYNTHETIC_TOKEN}"),
        ):
            with self.assertRaises(AuthenticationUnavailable) as raised:
                verify_supabase_access_token(
                    SYNTHETIC_TOKEN,
                    supabase_url="https://project.supabase.co",
                    anon_key="synthetic-public-key",
                    timeout=3,
                )

        self.assertNotIn(SYNTHETIC_TOKEN, str(raised.exception))


class AuthenticatedIdentityEndpointTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app(
            {
                "TESTING": True,
                "SUPABASE_URL": "https://project.supabase.co",
                "SUPABASE_ANON_KEY": "synthetic-public-key",
            }
        )
        self.client = self.app.test_client()

    def test_missing_and_malformed_bearer_headers_are_rejected(self):
        for authorization in (
            None,
            "Basic credentials",
            "Bearer",
            "Bearer malformed",
            f"Bearer {SYNTHETIC_TOKEN} extra",
        ):
            with self.subTest(authorization=authorization):
                headers = (
                    {"Authorization": authorization}
                    if authorization is not None
                    else {}
                )
                response = self.client.get("/api/auth/me", headers=headers)
                self.assertEqual(response.status_code, HTTPStatus.UNAUTHORIZED)
                self.assertEqual(response.json["error"], "authentication_required")

    def test_validated_identity_response_contains_no_staff_entitlement_or_secrets(self):
        with patch(
            "app.auth.verify_supabase_access_token",
            return_value=SYNTHETIC_USER_ID,
        ) as verify:
            response = self.client.get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {SYNTHETIC_TOKEN}"},
            )

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(
            response.json,
            {"status": "authenticated", "user": {"id": SYNTHETIC_USER_ID}},
        )
        self.assertNotIn(SYNTHETIC_TOKEN, response.get_data(as_text=True))
        self.assertNotIn("staff", response.get_data(as_text=True).casefold())
        verify.assert_called_once()

    def test_allowed_frontend_can_send_authorization_header(self):
        response = self.client.options(
            "/api/auth/me",
            headers={
                "Origin": "http://127.0.0.1:5173",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization",
            },
        )

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertIn(
            "Authorization",
            response.headers["Access-Control-Allow-Headers"],
        )

    def test_invalid_token_returns_generic_401(self):
        with patch(
            "app.auth.verify_supabase_access_token",
            side_effect=InvalidAccessToken,
        ):
            response = self.client.get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {SYNTHETIC_TOKEN}"},
            )

        self.assertEqual(response.status_code, HTTPStatus.UNAUTHORIZED)
        self.assertNotIn(SYNTHETIC_TOKEN, response.get_data(as_text=True))

    def test_supabase_unavailability_returns_generic_503(self):
        with patch(
            "app.auth.verify_supabase_access_token",
            side_effect=AuthenticationUnavailable,
        ):
            response = self.client.get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {SYNTHETIC_TOKEN}"},
            )

        self.assertEqual(response.status_code, HTTPStatus.SERVICE_UNAVAILABLE)
        self.assertNotIn(SYNTHETIC_TOKEN, response.get_data(as_text=True))

    def test_auth_configuration_missing_fails_closed(self):
        app = create_app({"TESTING": True})
        with patch("app.auth.verify_supabase_access_token") as verify:
            response = app.test_client().get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {SYNTHETIC_TOKEN}"},
            )

        self.assertEqual(response.status_code, HTTPStatus.SERVICE_UNAVAILABLE)
        verify.assert_not_called()

    def test_authentication_does_not_grant_staff_access_and_auth_errors_are_redacted(self):
        app = create_app(
            {
                "TESTING": False,
                "PROPAGATE_EXCEPTIONS": False,
                "SUPABASE_URL": "https://project.supabase.co",
                "SUPABASE_ANON_KEY": "synthetic-public-key",
            }
        )
        with patch(
            "app.auth.verify_supabase_access_token",
            side_effect=AuthenticationUnavailable(
                f"upstream error token={SYNTHETIC_TOKEN}"
            ),
        ):
            with self.assertLogs(app.logger, level=logging.ERROR) as captured:
                response = app.test_client().get(
                    "/api/auth/me",
                    headers={"Authorization": f"Bearer {SYNTHETIC_TOKEN}"},
                )

        logs = "\n".join(captured.output)
        self.assertEqual(response.status_code, HTTPStatus.SERVICE_UNAVAILABLE)
        self.assertNotIn(SYNTHETIC_TOKEN, logs)
        self.assertNotIn("synthetic-public-key", logs)
        self.assertNotIn("upstream error", logs)

    def test_authenticated_user_is_still_denied_staff_access(self):
        @self.app.get("/api/test/staff-only")
        @require_staff_access
        def staff_only_route():
            return {"status": "unexpectedly_allowed"}

        with patch(
            "app.auth.verify_supabase_access_token",
            return_value=SYNTHETIC_USER_ID,
        ):
            response = self.client.get(
                "/api/test/staff-only",
                headers={"Authorization": f"Bearer {SYNTHETIC_TOKEN}"},
            )

        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        self.assertEqual(
            response.json["error"],
            "staff_authorization_not_configured",
        )

    def test_unconfigured_auth_has_no_effect_on_existing_research_routes(self):
        app = create_app({"TESTING": True})
        client = app.test_client()

        self.assertEqual(client.get("/api/health").status_code, HTTPStatus.OK)
        self.assertEqual(
            client.get("/api/model/info").status_code,
            HTTPStatus.OK,
        )

    def test_existing_research_routes_remain_public(self):
        self.assertEqual(self.client.get("/api/health").status_code, HTTPStatus.OK)
        self.assertEqual(
            self.client.get("/api/model/info").status_code,
            HTTPStatus.OK,
        )
        self.assertEqual(
            self.client.get("/api/explain/status").status_code,
            HTTPStatus.OK,
        )


if __name__ == "__main__":
    unittest.main()
