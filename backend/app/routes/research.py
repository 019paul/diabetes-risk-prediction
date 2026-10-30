import math
from importlib.util import find_spec

from flask import Blueprint, current_app, jsonify, request

from ..logging_config import log_safe_error
from ..validation import InputValidationError, validate_assessment
from .common import model_unavailable_response


research_blueprint = Blueprint("research", __name__)


@research_blueprint.get("/api/model/info")
def model_info():
    bundle, error = current_app.extensions["model_registry"].load()
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


@research_blueprint.get("/api/model/exploration")
def model_exploration():
    bundle, error = current_app.extensions["model_registry"].load()
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


@research_blueprint.get("/api/explain/status")
def explanation_status():
    bundle, error = current_app.extensions["model_registry"].load()
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


@research_blueprint.post("/api/predict")
def predict():
    try:
        features = validate_assessment(request.get_json(silent=True))
    except InputValidationError as error:
        return jsonify(status="invalid", error="invalid_assessment", message=str(error)), 400

    bundle, error = current_app.extensions["model_registry"].load()
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
        log_safe_error(current_app.logger, "model_prediction_failed")
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
            log_safe_error(current_app.logger, "model_probability_conversion_failed")
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
            log_safe_error(current_app.logger, "model_probabilities_invalid")
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


@research_blueprint.post("/api/explain")
def explain():
    try:
        features = validate_assessment(request.get_json(silent=True))
    except InputValidationError as error:
        return jsonify(status="invalid", error="invalid_assessment", message=str(error)), 400

    bundle, error = current_app.extensions["model_registry"].load()
    if not bundle:
        return model_unavailable_response("individual_explanation", error)

    try:
        explanation = current_app.extensions["model_registry"].explain(
            bundle, features
        )
    except (ImportError, ModuleNotFoundError):
        return jsonify(
            status="unavailable",
            error="shap_dependency_missing",
            message="Install the optional machine-learning requirements to enable SHAP explanations.",
        ), 503
    except (AttributeError, IndexError, TypeError, ValueError, RuntimeError):
        log_safe_error(current_app.logger, "shap_explanation_failed")
        return jsonify(
            status="unavailable",
            error="shap_explanation_failed",
            message="A SHAP explanation could not be calculated for this assessment.",
        ), 503

    return jsonify(explanation)
