import unittest
from pathlib import Path

from app.config import BackendSettings, ConfigurationError


class BackendSettingsTests(unittest.TestCase):
    def test_defaults_keep_database_optional_and_bind_localhost(self):
        settings = BackendSettings.from_environment(environment={})

        self.assertEqual(settings.flask_host, "127.0.0.1")
        self.assertEqual(settings.flask_port, 5000)
        self.assertIsNone(settings.database_url)
        self.assertEqual(settings.max_content_length, 4096)
        self.assertEqual(
            settings.api_allowed_origins,
            (
                "http://127.0.0.1:5173",
                "http://localhost:5173",
                "http://127.0.0.1:5174",
                "http://localhost:5174",
            ),
        )

    def test_resolves_relative_model_path_from_backend_directory(self):
        backend_directory = Path("C:/faith-clinic/backend")
        settings = BackendSettings.from_environment(
            environment={"MODEL_ARTIFACT_DIR": "./models"},
            backend_directory=backend_directory,
        )

        self.assertEqual(
            Path(settings.model_artifact_dir),
            (backend_directory / "models").resolve(),
        )

    def test_accepts_valid_optional_postgresql_url_without_representing_secret(self):
        secret_url = "postgresql://user:top-secret@db.example.test:5432/clinic"
        settings = BackendSettings.from_environment(
            environment={"DATABASE_URL": secret_url}
        )

        self.assertEqual(settings.database_url, secret_url)
        self.assertNotIn("top-secret", repr(settings))
        self.assertEqual(settings.database_connect_timeout, 3)

    def test_secret_settings_are_not_in_settings_representation(self):
        settings = BackendSettings.from_environment(
            environment={
                "DATABASE_URL": "postgresql://user:db-secret@localhost/clinic",
                "HFR_API_KEY": "facility-secret",
            }
        )

        self.assertNotIn("db-secret", repr(settings))
        self.assertNotIn("facility-secret", repr(settings))

    def test_accepts_optional_supabase_auth_configuration(self):
        settings = BackendSettings.from_environment(
            environment={
                "SUPABASE_URL": "https://project.supabase.co/",
                "SUPABASE_ANON_KEY": "public-key-sentinel",
                "SUPABASE_AUTH_TIMEOUT_SECONDS": "5",
            }
        )

        self.assertEqual(settings.supabase_url, "https://project.supabase.co")
        self.assertEqual(settings.supabase_anon_key, "public-key-sentinel")
        self.assertEqual(settings.supabase_auth_timeout, 5)
        self.assertNotIn("public-key-sentinel", repr(settings))

    def test_supabase_auth_configuration_must_be_complete_and_safe(self):
        invalid_environments = (
            {"SUPABASE_URL": "https://project.supabase.co"},
            {"SUPABASE_ANON_KEY": "public-key"},
            {
                "SUPABASE_URL": "http://project.supabase.co",
                "SUPABASE_ANON_KEY": "public-key",
            },
            {
                "SUPABASE_URL": "https://project.supabase.co/path",
                "SUPABASE_ANON_KEY": "public-key",
            },
        )
        for environment in invalid_environments:
            with self.subTest(setting_names=tuple(environment)):
                with self.assertRaisesRegex(ConfigurationError, "SUPABASE"):
                    BackendSettings.from_environment(environment=environment)

    def test_rejects_invalid_supabase_auth_timeout(self):
        with self.assertRaisesRegex(
            ConfigurationError, "SUPABASE_AUTH_TIMEOUT_SECONDS"
        ):
            BackendSettings.from_environment(
                environment={"SUPABASE_AUTH_TIMEOUT_SECONDS": "0"}
            )

    def test_rejects_malformed_database_url_without_echoing_value(self):
        secret_url = "not-a-url-with-secret"

        with self.assertRaises(ConfigurationError) as raised:
            BackendSettings.from_environment(
                environment={"DATABASE_URL": secret_url}
            )

        self.assertIn("DATABASE_URL", str(raised.exception))
        self.assertNotIn(secret_url, str(raised.exception))

    def test_rejects_invalid_port(self):
        with self.assertRaisesRegex(ConfigurationError, "FLASK_PORT"):
            BackendSettings.from_environment(
                environment={"FLASK_PORT": "70000"}
            )

    def test_refuses_to_bind_development_server_to_public_interfaces(self):
        with self.assertRaisesRegex(ConfigurationError, "FLASK_HOST"):
            BackendSettings.from_environment(
                environment={"FLASK_HOST": "0.0.0.0"}
            )

    def test_rejects_database_url_with_invalid_port_without_echoing_url(self):
        database_url = "postgresql://user:secret@localhost:not-a-port/clinic"

        with self.assertRaisesRegex(ConfigurationError, "DATABASE_URL") as raised:
            BackendSettings.from_environment(
                environment={"DATABASE_URL": database_url}
            )

        self.assertNotIn("secret", str(raised.exception))

    def test_rejects_invalid_database_connect_timeout(self):
        with self.assertRaisesRegex(ConfigurationError, "DATABASE_CONNECT_TIMEOUT_SECONDS"):
            BackendSettings.from_environment(
                environment={"DATABASE_CONNECT_TIMEOUT_SECONDS": "0"}
            )

    def test_rejects_origins_with_paths_or_credentials(self):
        for origin in (
            "https://example.test/clinical",
            "https://user:password@example.test",
        ):
            with self.subTest(origin_kind="path" if "/" in origin[8:] else "credentials"):
                with self.assertRaisesRegex(
                    ConfigurationError, "API_ALLOWED_ORIGINS"
                ):
                    BackendSettings.from_environment(
                        environment={"API_ALLOWED_ORIGINS": origin}
                    )


if __name__ == "__main__":
    unittest.main()
