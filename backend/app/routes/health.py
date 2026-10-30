from flask import Blueprint, current_app, jsonify

from ..database import check_database_connection


health_blueprint = Blueprint("health", __name__)


@health_blueprint.get("/api/health")
def health():
    bundle, error = current_app.extensions["model_registry"].load()
    return jsonify(
        status="ok",
        api="available",
        model_status="ready" if bundle else "not_ready",
        model_error=error,
    )


@health_blueprint.get("/api/health/database")
def database_health():
    readiness = check_database_connection(
        current_app.config["DATABASE_URL"],
        current_app.config["DATABASE_CONNECT_TIMEOUT_SECONDS"],
    )
    return jsonify(status=readiness.status, database=readiness.to_dict())
