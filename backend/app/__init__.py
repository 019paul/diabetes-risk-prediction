import json
import math
import os
from importlib.util import find_spec
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from flask import Flask, jsonify, request

from .model_registry import ModelRegistry
from .validation import InputValidationError, validate_assessment


BACKEND_DIRECTORY = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIRECTORY / ".env")


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_mapping(
        MAX_CONTENT_LENGTH=4096,
        MODEL_ARTIFACT_DIR=os.environ.get(
            "MODEL_ARTIFACT_DIR",
            str(BACKEND_DIRECTORY / "model_artifacts"),
        ),
        API_ALLOWED_ORIGINS=os.environ.get(
            "API_ALLOWED_ORIGINS",
            (
                "http://127.0.0.1:5173,http://localhost:5173,"
                "http://127.0.0.1:5174,http://localhost:5174"
            ),
        ),
    )
    if test_config:
        app.config.update(test_config)

    artifact_directory = Path(app.config["MODEL_ARTIFACT_DIR"]).expanduser()
    if not artifact_directory.is_absolute():
        artifact_directory = BACKEND_DIRECTORY / artifact_directory
    app.config["MODEL_ARTIFACT_DIR"] = str(artifact_directory.resolve())
    registry = ModelRegistry(Path(app.config["MODEL_ARTIFACT_DIR"]))
    app.extensions["model_registry"] = registry
    allowed_origins = {
        origin.strip()
        for origin in app.config["API_ALLOWED_ORIGINS"].split(",")
        if origin.strip()
    }

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        if origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    def model_unavailable_response(feature="model", artifact_error=None):
        message = artifact_error or (
            "The research model has not been trained and configured. "
            "No prediction, evaluation metrics, or explanation is available."
        )
        return jsonify(
            status="not_ready",
            error=f"{feature}_not_ready",
            message=message,
            model_error=artifact_error,
        ), 503

    @app.post("/api/facilities/nearby")
    def nearby_facilities():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify(
                status="invalid",
                error="invalid_location",
                message="Provide latitude and longitude as a JSON object.",
            ), 400

        try:
            latitude = float(payload["latitude"])
            longitude = float(payload["longitude"])
        except (KeyError, TypeError, ValueError):
            return jsonify(
                status="invalid",
                error="invalid_location",
                message="Provide valid latitude and longitude coordinates.",
            ), 400
        if (
            not math.isfinite(latitude)
            or not math.isfinite(longitude)
            or not -90 <= latitude <= 90
            or not -180 <= longitude <= 180
        ):
            return jsonify(
                status="invalid",
                error="invalid_location",
                message="Latitude or longitude is outside its valid range.",
            ), 400

        api_key = os.environ.get("HFR_API_KEY", "").strip()
        if not api_key:
            return jsonify(
                status="unavailable",
                error="facility_registry_key_missing",
                message=(
                    "Official facility registration search needs an approved "
                    "Nigeria Health Facility Registry API key."
                ),
            ), 503

        parameters = urlencode(
            {
                "near": f"{latitude}|{longitude}|5|km",
                "has_coordinates": "true",
                "per_page": 100,
                "page": 1,
            }
        )
        upstream_request = Request(
            f"https://backend.hfr.fmohconnect.gov.ng/api/v1/facilities?{parameters}",
            headers={
                "Accept": "application/json",
                "User-Agent": "FaithClinicResearch/1.0",
                "X-API-Key": api_key,
            },
        )

        try:
            with urlopen(upstream_request, timeout=15) as response:
                data = json.load(response)
        except HTTPError as error:
            app.logger.error("Official facility registry returned HTTP %s.", error.code)
            return jsonify(
                status="unavailable",
                error="facility_registry_request_failed",
                message="The official facility registry could not complete this search.",
            ), 503
        except (TimeoutError, URLError, OSError, json.JSONDecodeError):
            app.logger.exception("Official facility registry request failed.")
            return jsonify(
                status="unavailable",
                error="facility_registry_unavailable",
                message="The official facility registry is temporarily unavailable.",
            ), 503

        response_data = data.get("data") if isinstance(data, dict) else None
        records = response_data.get("facilities") if isinstance(response_data, dict) else None
        if not isinstance(data, dict) or data.get("status") != "success" or not isinstance(records, list):
            app.logger.error("Official facility registry returned an unexpected response.")
            return jsonify(
                status="unavailable",
                error="facility_registry_invalid_response",
                message="The official facility registry returned an unusable response.",
            ), 503

        facilities = []
        for record in records:
            if not isinstance(record, dict):
                continue
            location = record.get("location") or {}
            if not isinstance(location, dict):
                continue
            try:
                facility_latitude = float(location["latitude"])
                facility_longitude = float(location["longitude"])
            except (KeyError, TypeError, ValueError):
                continue
            if (
                not math.isfinite(facility_latitude)
                or not math.isfinite(facility_longitude)
                or not -90 <= facility_latitude <= 90
                or not -180 <= facility_longitude <= 180
            ):
                continue

            latitude_delta = math.radians(facility_latitude - latitude)
            longitude_delta = math.radians(facility_longitude - longitude)
            haversine = (
                math.sin(latitude_delta / 2) ** 2
                + math.cos(math.radians(latitude))
                * math.cos(math.radians(facility_latitude))
                * math.sin(longitude_delta / 2) ** 2
            )
            distance = 6371 * 2 * math.atan2(
                math.sqrt(haversine), math.sqrt(1 - haversine)
            )
            if distance > 5 or not record.get("facility_name"):
                continue

            state_data = location.get("state") or {}
            state = state_data.get("name", "") if isinstance(state_data, dict) else ""
            lga_data = location.get("lga") or {}
            lga = lga_data.get("name", "") if isinstance(lga_data, dict) else ""
            address_data = record.get("address")
            if isinstance(address_data, dict):
                address_data = address_data.get("full") or address_data.get("line")
            address = address_data if isinstance(address_data, str) else ""
            if not address:
                address = ", ".join(value for value in (lga, state) if value)
            status = record.get("status") or {}
            if not isinstance(status, dict):
                status = {}
            registration = status.get("registration") or {}
            if not isinstance(registration, dict):
                registration = {}
            operational = status.get("operational") or {}
            if not isinstance(operational, dict):
                operational = {}
            contact = record.get("contact") or {}
            if not isinstance(contact, dict):
                contact = {}
            facility_id = record.get("id") or record.get("unique_id")
            facilities.append(
                {
                    "id": str(facility_id or f"{record['facility_name']}-{facility_latitude}-{facility_longitude}"),
                    "name": record["facility_name"],
                    "address": address,
                    "distance": distance,
                    "latitude": facility_latitude,
                    "longitude": facility_longitude,
                    "phone": contact.get("phone_number") or "",
                    "registrationStatus": registration.get("name") or "Not specified",
                    "registered": (registration.get("name") or "").casefold()
                    == "registered",
                    "operationalStatus": operational.get("name") or "Not specified",
                    "updatedAt": record.get("updated_at") or "",
                    "mapUrl": "https://hfr.fmohconnect.gov.ng/",
                    "directionsUrl": (
                        "https://www.google.com/maps/dir/?api=1&destination="
                        f"{facility_latitude},{facility_longitude}"
                    ),
                }
            )

        facilities.sort(key=lambda facility: (not facility["registered"], facility["distance"]))
        return jsonify(
            status="ready",
            source="Nigeria Health Facility Registry",
            radius_km=5,
            facilities=facilities[:30],
        )

    @app.get("/api/health")
    def health():
        bundle, error = registry.load()
        return jsonify(
            status="ok",
            api="available",
            model_status="ready" if bundle else "not_ready",
            model_error=error,
        )

    @app.get("/api/model/info")
    def model_info():
        bundle, error = registry.load()
        if not bundle:
            return jsonify(
                status="not_ready",
                model_status="not_ready",
                message=error or (
                    "Model has not been trained or configured. Approved data "
                    "preparation and an evaluated model artifact are required."
                ),
                model_error=error,
                objective="Classify self-reported previous diabetes diagnosis.",
            )

        return jsonify(
            status="ready",
            model_status="ready",
            objective="Classify self-reported previous diabetes diagnosis.",
            target=bundle["evaluation"]["target"],
            model_version=bundle["model_version"],
            evaluation=bundle["evaluation"]["evaluation"],
        )

    @app.get("/api/model/exploration")
    def model_exploration():
        bundle, error = registry.load()
        if not bundle:
            return model_unavailable_response("model_exploration", error)

        return jsonify(
            status="ready",
            objective="Classify self-reported previous diabetes diagnosis.",
            evaluation=bundle["evaluation"]["evaluation"],
            analytic_sample={
                "n": bundle["evaluation"]["complete_case_analytic_sample_n"],
                "target_class_counts": bundle["evaluation"]["target_class_counts"],
            },
            model_version=bundle["model_version"],
            interpretation=(
                "Unweighted held-out analytic-sample metrics; not a claim of "
                "nationally representative performance."
            ),
        )

    @app.get("/api/explain/status")
    def explanation_status():
        bundle, error = registry.load()
        if not bundle:
            return jsonify(
                status="not_ready",
                message=error or (
                    "Individual SHAP explanations are unavailable until an "
                    "evaluated model has been trained and configured."
                ),
                model_error=error,
            )
        if find_spec("shap") is None:
            return jsonify(
                status="unavailable",
                message="The trained model is ready, but the optional SHAP package is not installed.",
            )
        return jsonify(
            status="ready",
            message="The configured model and SHAP package are available for explanations.",
        )

    @app.post("/api/predict")
    def predict():
        try:
            features = validate_assessment(request.get_json(silent=True))
        except InputValidationError as error:
            return jsonify(status="invalid", error="invalid_assessment", message=str(error)), 400

        bundle, error = registry.load()
        if not bundle:
            return model_unavailable_response("prediction", error)

        pipeline = bundle["pipeline"]
        import pandas as pd

        row = pd.DataFrame(
            [[features[column] for column in bundle["feature_columns"]]],
            columns=bundle["feature_columns"],
        )
        try:
            predicted_class = int(pipeline.predict(row)[0])
            probabilities = (
                pipeline.predict_proba(row)[0]
                if hasattr(pipeline, "predict_proba")
                else None
            )
        except (AttributeError, IndexError, TypeError, ValueError, RuntimeError):
            app.logger.exception("Model prediction failed")
            return jsonify(
                status="unavailable",
                error="prediction_failed",
                message="The research model could not process this assessment.",
            ), 503
        classes = [int(value) for value in pipeline.named_steps["classifier"].classes_]
        class_labels = {
            0: "No self-reported previous diabetes diagnosis",
            1: "Yes, self-reported previous diabetes diagnosis",
        }
        class_probabilities = None
        if probabilities is not None:
            try:
                probability_values = [float(value) for value in probabilities]
            except (TypeError, ValueError, OverflowError):
                app.logger.exception("Model returned invalid class probabilities")
                return jsonify(
                    status="unavailable",
                    error="invalid_model_probabilities",
                    message="The research model returned invalid class probabilities.",
                ), 503
            if (
                len(probability_values) != len(classes)
                or any(
                    not math.isfinite(value) or not 0 <= value <= 1
                    for value in probability_values
                )
                or not math.isclose(
                    sum(probability_values), 1.0, rel_tol=0.0, abs_tol=1e-6
                )
                or 0 not in classes
                or 1 not in classes
            ):
                app.logger.error("Model returned invalid class probabilities")
                return jsonify(
                    status="unavailable",
                    error="invalid_model_probabilities",
                    message="The research model returned invalid class probabilities.",
                ), 503
            class_probabilities = dict(zip(classes, probability_values))
        result = {
            "status": "ready",
            "target": "self-reported previous diabetes diagnosis",
            "predicted_class": class_labels[predicted_class],
            "predicted_class_probability": None,
            "positive_class_probability": None,
            "negative_class_probability": None,
            "model_version": bundle["model_version"],
            "interpretation": (
                "This classifies reported previous diagnosis in the research-data "
                "setting. It does not predict future diabetes or diagnose a person."
            ),
        }
        if class_probabilities is not None:
            result["predicted_class_probability"] = float(
                class_probabilities[predicted_class]
            )
            result["positive_class_probability"] = float(class_probabilities[1])
            result["negative_class_probability"] = float(class_probabilities[0])
        return jsonify(result)

    @app.post("/api/explain")
    def explain():
        try:
            features = validate_assessment(request.get_json(silent=True))
        except InputValidationError as error:
            return jsonify(status="invalid", error="invalid_assessment", message=str(error)), 400

        bundle, error = registry.load()
        if not bundle:
            return model_unavailable_response("individual_explanation", error)

        try:
            explanation = registry.explain(bundle, features)
        except (ImportError, ModuleNotFoundError):
            return jsonify(
                status="unavailable",
                error="shap_dependency_missing",
                message="Install the optional machine-learning requirements to enable SHAP explanations.",
            ), 503
        except (AttributeError, IndexError, TypeError, ValueError, RuntimeError):
            app.logger.exception("SHAP explanation failed")
            return jsonify(
                status="unavailable",
                error="shap_explanation_failed",
                message="A SHAP explanation could not be calculated for this assessment.",
            ), 503

        return jsonify(explanation)

    @app.errorhandler(413)
    def request_too_large(_error):
        return jsonify(
            status="invalid",
            error="request_too_large",
            message="The assessment request is larger than this API accepts.",
        ), 413

    return app