from flask import jsonify


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
