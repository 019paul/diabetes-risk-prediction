from pathlib import Path

from flask import Flask, request

from .config import BackendSettings
from .errors import install_error_handlers
from .logging_config import install_request_logging
from .model_registry import ModelRegistry
from .routes import (
    auth_blueprint,
    facilities_blueprint,
    health_blueprint,
    research_blueprint,
)


BACKEND_DIRECTORY = Path(__file__).resolve().parents[1]


def create_app(test_config=None):
    app = Flask(__name__)
    settings = BackendSettings.from_environment(
        overrides=test_config,
        backend_directory=BACKEND_DIRECTORY,
    )
    app.config.from_mapping(settings.to_flask_config())
    if test_config:
        app.config.update(
            {
                key: value
                for key, value in test_config.items()
                if key not in settings.to_flask_config()
            }
        )

    install_request_logging(app)
    install_error_handlers(app)
    app.extensions["model_registry"] = ModelRegistry(
        Path(app.config["MODEL_ARTIFACT_DIR"])
    )

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
            response.headers["Access-Control-Allow-Headers"] = (
                "Content-Type, Authorization"
            )
            response.headers["Access-Control-Expose-Headers"] = "X-Request-ID"
        return response

    app.register_blueprint(auth_blueprint)
    app.register_blueprint(health_blueprint)
    app.register_blueprint(facilities_blueprint)
    app.register_blueprint(research_blueprint)
    return app
