import logging
import uuid

from flask import Flask, g, request


def current_request_id() -> str:
    return getattr(g, "request_id", "")


def log_safe_error(logger: logging.Logger, event: str) -> None:
    logger.error("%s request_id=%s", event, current_request_id())


def install_request_logging(app: Flask) -> None:
    logging.getLogger("werkzeug").setLevel(logging.WARNING)

    @app.before_request
    def assign_request_id() -> None:
        g.request_id = uuid.uuid4().hex

    @app.after_request
    def log_response(response):
        request_id = current_request_id()
        response.headers["X-Request-ID"] = request_id
        route = request.url_rule.rule if request.url_rule else "unmatched"
        app.logger.info(
            "api_request request_id=%s method=%s route=%s status=%s",
            request_id,
            request.method,
            route,
            response.status_code,
        )
        return response
