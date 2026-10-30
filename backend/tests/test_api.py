import io
import json
import re
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from app import create_app
from app.database import DatabaseReadiness
from app.validation import FEATURE_COLUMNS


class ApiStatusTests(unittest.TestCase):
    def setUp(self):
        self.artifact_directory = tempfile.TemporaryDirectory()
        self.app = create_app(
            {
                "TESTING": True,
                "MODEL_ARTIFACT_DIR": self.artifact_directory.name,
                "API_ALLOWED_ORIGINS": (
                    "http://127.0.0.1:5173,http://localhost:5173,"
                    "http://127.0.0.1:5174,http://localhost:5174"
                ),
            }
        )
        self.client = self.app.test_client()

    def tearDown(self):
        self.artifact_directory.cleanup()

    def test_health_reports_backend_up_and_missing_model_artifacts(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["api"], "available")
        self.assertEqual(response.json["model_status"], "not_ready")
        self.assertIn("missing", response.json["model_error"])

    def test_database_health_reports_optional_database_as_not_configured(self):
        response = self.client.get("/api/health/database")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "not_configured")
        self.assertFalse(response.json["database"]["configured"])

    def test_database_health_reports_readiness_without_exposing_connection_url(self):
        app = create_app(
            {
                "TESTING": True,
                "MODEL_ARTIFACT_DIR": self.artifact_directory.name,
                "DATABASE_URL": "postgresql://test:secret@localhost/test",
            }
        )
        client = app.test_client()
        with patch(
            "app.routes.health.check_database_connection",
            return_value=DatabaseReadiness(status="ready", configured=True),
        ) as check_connection:
            response = client.get("/api/health/database")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "ready")
        self.assertNotIn("secret", response.get_data(as_text=True))
        check_connection.assert_called_once_with(
            "postgresql://test:secret@localhost/test",
            3,
        )

    def test_existing_api_routes_remain_registered(self):
        routes = {
            (rule.rule, method)
            for rule in self.app.url_map.iter_rules()
            for method in rule.methods
            if method in {"GET", "POST"}
        }

        self.assertTrue(
            {
                ("/api/facilities/nearby", "POST"),
                ("/api/health", "GET"),
                ("/api/health/database", "GET"),
                ("/api/model/info", "GET"),
                ("/api/model/exploration", "GET"),
                ("/api/explain/status", "GET"),
                ("/api/predict", "POST"),
                ("/api/explain", "POST"),
            }.issubset(routes)
        )

    def test_health_and_model_information_report_the_same_registry_status(self):
        health = self.client.get("/api/health")
        information = self.client.get("/api/model/info")
        self.assertEqual(
            health.json["model_status"], information.json["model_status"]
        )
        self.assertEqual(health.json["model_error"], information.json["model_error"])

    def test_model_information_does_not_invent_metrics(self):
        response = self.client.get("/api/model/info")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "not_ready")
        self.assertNotIn("evaluation", response.json)
        self.assertIn("missing", response.json["message"])
        self.assertIn("missing", response.json["model_error"])

    def test_relative_artifact_directory_resolves_from_backend_directory(self):
        app = create_app({"MODEL_ARTIFACT_DIR": "./model_artifacts"})
        expected = Path(__file__).resolve().parents[1] / "model_artifacts"
        self.assertEqual(Path(app.config["MODEL_ARTIFACT_DIR"]), expected.resolve())

    def test_facility_registry_requires_an_api_key_without_exposing_credentials(self):
        with patch.dict(self.app.config, {"HFR_API_KEY": ""}):
            response = self.client.post(
                "/api/facilities/nearby",
                json={"latitude": 9.05, "longitude": 7.49},
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json["error"], "facility_registry_key_missing")
        self.assertNotIn("api_key", response.get_data(as_text=True))

    def test_facility_registry_rejects_invalid_coordinates(self):
        response = self.client.post(
            "/api/facilities/nearby",
            json={"latitude": 95, "longitude": 7.49},
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json["error"], "invalid_location")

    def test_facility_registry_returns_registered_records_without_exposing_key(self):
        upstream = {
            "status": "success",
            "data": {
                "facilities": [
                    {
                        "id": 123,
                        "facility_name": "General Hospital",
                        "location": {
                            "latitude": 9.05,
                            "longitude": 7.49,
                            "lga": {"name": "Abuja Municipal"},
                            "state": {"name": "FCT"},
                        },
                        "status": {
                            "registration": {"name": "Registered"},
                            "operational": {"name": "Operational"},
                        },
                        "contact": {"phone_number": "+234 700 000 0000"},
                    }
                ]
            },
        }
        with (
            patch.dict(self.app.config, {"HFR_API_KEY": "test-secret"}),
            patch(
                "app.routes.facilities.urlopen",
                return_value=io.BytesIO(json.dumps(upstream).encode()),
            ) as urlopen_mock,
        ):
            response = self.client.post(
                "/api/facilities/nearby",
                json={"latitude": 9.05, "longitude": 7.49},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["source"], "Nigeria Health Facility Registry")
        self.assertTrue(response.json["facilities"][0]["registered"])
        self.assertEqual(response.json["facilities"][0]["registrationStatus"], "Registered")
        self.assertNotIn("test-secret", response.get_data(as_text=True))
        upstream_request = urlopen_mock.call_args.args[0]
        self.assertEqual(upstream_request.get_header("X-api-key"), "test-secret")
        self.assertNotIn("test-secret", upstream_request.full_url)

    def test_facility_registry_rejects_unexpected_upstream_schema(self):
        upstream = {"status": "success", "data": {"facilities": "not-a-list"}}
        with (
            patch.dict(self.app.config, {"HFR_API_KEY": "test-secret"}),
            patch(
                "app.routes.facilities.urlopen",
                return_value=io.BytesIO(json.dumps(upstream).encode()),
            ),
        ):
            response = self.client.post(
                "/api/facilities/nearby",
                json={"latitude": 9.05, "longitude": 7.49},
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json["error"], "facility_registry_invalid_response")
        self.assertNotIn("test-secret", response.get_data(as_text=True))

    def test_model_exploration_is_unavailable_without_artifacts(self):
        response = self.client.get("/api/model/exploration")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json["status"], "not_ready")
        self.assertNotIn("metrics", response.json)

    def test_prediction_rejects_missing_and_invalid_fields_before_model_check(self):
        missing = self.client.post("/api/predict", json={"age": 44})
        invalid = self.client.post(
            "/api/predict",
            json={
                "age": 19,
                "sex": "Female",
                "bmi": 25,
                "hypertension": "No",
                "heart_disease": "No",
                "fasting_glucose": 95,
                "hba1c": 5.4,
                "smoking_history": "Never",
            },
        )
        self.assertEqual(missing.status_code, 400)
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(missing.json["error"], "invalid_assessment")
        self.assertEqual(invalid.json["error"], "invalid_assessment")
        self.assertNotIn("age", invalid.json)

    def test_prediction_rejects_unexpected_personal_fields(self):
        response = self.client.post(
            "/api/predict",
            json={
                "age": 44,
                "sex": "Female",
                "bmi": 25,
                "hypertension": "No",
                "heart_disease": "No",
                "fasting_glucose": 95,
                "hba1c": 5.4,
                "smoking_history": "Never",
                "patient_name": "not accepted",
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("patient_name", response.json)

    def test_explanation_status_is_not_ready_without_model_artifacts(self):
        response = self.client.get("/api/explain/status")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["status"], "not_ready")
        self.assertNotIn("feature_contributions", response.json)

    def test_prediction_maps_positive_class_and_passes_named_features(self):
        class DataFrameOnlyPipeline:
            named_steps = {"classifier": SimpleNamespace(classes_=[0, 1])}

            def predict(self, rows):
                self.assert_dataframe(rows)
                return [1]

            def predict_proba(self, rows):
                self.assert_dataframe(rows)
                return [[0.2, 0.8]]

            @staticmethod
            def assert_dataframe(rows):
                import pandas as pd

                if not isinstance(rows, pd.DataFrame):
                    raise AssertionError("The pipeline requires named dataframe columns.")
                if list(rows.columns) != FEATURE_COLUMNS:
                    raise AssertionError("The pipeline received unexpected columns.")

        payload = {
            "age": 44,
            "sex": "Female",
            "bmi": 25,
            "hypertension": "No",
            "heart_disease": "No",
            "fasting_glucose": 95,
            "hba1c": 5.4,
            "smoking_history": "Never",
        }
        registry = self.app.extensions["model_registry"]
        bundle = {
            "pipeline": DataFrameOnlyPipeline(),
            "feature_columns": FEATURE_COLUMNS,
            "model_version": "test-version",
        }
        with patch.object(registry, "load", return_value=(bundle, None)):
            response = self.client.post("/api/predict", json=payload)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["predicted_class_probability"], 0.8)
        self.assertEqual(response.json["positive_class_probability"], 0.8)
        self.assertEqual(response.json["negative_class_probability"], 0.2)
        self.assertAlmostEqual(
            response.json["positive_class_probability"]
            + response.json["negative_class_probability"],
            1.0,
        )
        self.assertEqual(
            response.json["predicted_class"],
            "Yes, self-reported previous diabetes diagnosis",
        )
        self.assertIn("previous diabetes diagnosis", response.json["target"])

    def test_prediction_maps_negative_class_probability_explicitly(self):
        class NegativeClassPipeline:
            named_steps = {"classifier": SimpleNamespace(classes_=[0, 1])}

            def predict(self, rows):
                return [0]

            def predict_proba(self, rows):
                return [[0.8, 0.2]]

        payload = {
            "age": 44,
            "sex": "Female",
            "bmi": 25,
            "hypertension": "No",
            "heart_disease": "No",
            "fasting_glucose": 95,
            "hba1c": 5.4,
            "smoking_history": "Never",
        }
        registry = self.app.extensions["model_registry"]
        bundle = {
            "pipeline": NegativeClassPipeline(),
            "feature_columns": FEATURE_COLUMNS,
            "model_version": "test-version",
        }
        with patch.object(registry, "load", return_value=(bundle, None)):
            response = self.client.post("/api/predict", json=payload)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json["predicted_class"],
            "No self-reported previous diabetes diagnosis",
        )
        self.assertEqual(response.json["predicted_class_probability"], 0.8)
        self.assertEqual(response.json["negative_class_probability"], 0.8)
        self.assertEqual(response.json["positive_class_probability"], 0.2)

    def test_prediction_and_explanation_are_unavailable_without_model(self):
        payload = {
            "age": 44,
            "sex": "Female",
            "bmi": 25,
            "hypertension": "No",
            "heart_disease": "No",
            "fasting_glucose": 95,
            "hba1c": 5.4,
            "smoking_history": "Never",
        }
        prediction = self.client.post("/api/predict", json=payload)
        explanation = self.client.post("/api/explain", json=payload)
        self.assertEqual(prediction.status_code, 503)
        self.assertEqual(explanation.status_code, 503)
        self.assertNotIn("predicted_class", prediction.json)
        self.assertNotIn("feature_contributions", explanation.json)

    def test_cors_is_limited_to_configured_frontend_origin(self):
        for origin in (
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:5174",
            "http://localhost:5174",
        ):
            allowed = self.client.get("/api/health", headers={"Origin": origin})
            self.assertEqual(
                allowed.headers.get("Access-Control-Allow-Origin"), origin
            )
        denied = self.client.get(
            "/api/health", headers={"Origin": "https://unapproved.example"}
        )
        self.assertIsNone(denied.headers.get("Access-Control-Allow-Origin"))

    def test_supabase_history_migration_enforces_per_user_row_security(self):
        migration = (
            Path(__file__).resolve().parents[2]
            / "supabase"
            / "migrations"
            / "20261028000100_prediction_history.sql"
        ).read_text(encoding="utf-8")
        self.assertRegex(migration, r"enable row level security")
        self.assertRegex(migration, r"force row level security")
        self.assertGreaterEqual(
            len(re.findall(r"auth\.uid\(\).*user_id", migration, flags=re.IGNORECASE)),
            2,
        )
        self.assertNotRegex(migration, r"service_role")


if __name__ == "__main__":
    unittest.main()