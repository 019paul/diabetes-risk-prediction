import re
import tempfile
import unittest

from app import create_app


class ApiErrorHandlingTests(unittest.TestCase):
    def setUp(self):
        self.artifact_directory = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.artifact_directory.cleanup()

    def make_app(self, **overrides):
        config = {
            "MODEL_ARTIFACT_DIR": self.artifact_directory.name,
            **overrides,
        }
        return create_app(config)

    def test_not_found_response_is_json_with_request_id(self):
        response = self.make_app().test_client().get("/api/missing")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            response.json,
            {
                "status": "invalid",
                "error": "not_found",
                "message": "The requested API resource was not found.",
            },
        )
        self.assertRegex(response.headers["X-Request-ID"], re.compile(r"^[0-9a-f]{32}$"))

    def test_request_too_large_keeps_existing_error_body(self):
        app = self.make_app(MAX_CONTENT_LENGTH=16)
        response = app.test_client().post(
            "/api/predict",
            data=b'{"synthetic":"request body exceeding the configured size"}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 413)
        self.assertEqual(
            response.json,
            {
                "status": "invalid",
                "error": "request_too_large",
                "message": "The assessment request is larger than this API accepts.",
            },
        )

    def test_unhandled_error_is_generic_and_sensitive_values_are_not_logged(self):
        app = self.make_app(TESTING=False, PROPAGATE_EXCEPTIONS=False)

        @app.post("/api/test/failure")
        def fail_for_test():
            raise RuntimeError("token=synthetic-secret patient=demo@example.invalid")

        response = None
        with self.assertLogs(app.logger, level="ERROR") as captured:
            response = app.test_client().post(
                "/api/test/failure",
                json={
                    "token": "synthetic-secret",
                    "patient_email": "demo@example.invalid",
                },
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json,
            {
                "status": "unavailable",
                "error": "internal_server_error",
                "message": "An unexpected server error occurred.",
            },
        )
        self.assertNotIn("synthetic-secret", response.get_data(as_text=True))
        self.assertNotIn("demo@example.invalid", response.get_data(as_text=True))
        self.assertNotIn("synthetic-secret", "\n".join(captured.output))
        self.assertNotIn("demo@example.invalid", "\n".join(captured.output))
        self.assertNotIn("token=", "\n".join(captured.output))


if __name__ == "__main__":
    unittest.main()
