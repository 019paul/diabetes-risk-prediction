from http import HTTPStatus

from flask import Flask, current_app, jsonify
from werkzeug.exceptions import HTTPException

from .logging_config import current_request_id


def install_error_handlers(app: Flask) -> None:
    @app.errorhandler(HTTPException)
    def handle_http_exception(error: HTTPException):
        status_code = error.code or 500
        if status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE:
            return jsonify(
                status="invalid",
                error="request_too_large",
                message="The assessment request is larger than this API accepts.",
            ), status_code

        if status_code < 500:
            error_code, message = _client_error(status_code)
            status = "invalid"
        else:
            error_code = "internal_server_error"
            message = "An unexpected server error occurred."
            status = "unavailable"
        return jsonify(status=status, error=error_code, message=message), status_code

    @app.errorhandler(Exception)
    def handle_unexpected_exception(_error: Exception):
        current_app.logger.error(
            "unhandled_api_error request_id=%s exception_type=%s",
            current_request_id(),
            type(_error).__name__,
        )
        return jsonify(
            status="unavailable",
            error="internal_server_error",
            message="An unexpected server error occurred.",
        ), HTTPStatus.INTERNAL_SERVER_ERROR


def _client_error(status_code: int) -> tuple[str, str]:
    known_errors = {
        HTTPStatus.BAD_REQUEST: (
            "bad_request",
            "The request could not be understood.",
        ),
        HTTPStatus.UNAUTHORIZED: (
            "unauthorized",
            "Authentication is required for this request.",
        ),
        HTTPStatus.FORBIDDEN: (
            "forbidden",
            "This request is not permitted.",
        ),
        HTTPStatus.NOT_FOUND: (
            "not_found",
            "The requested API resource was not found.",
        ),
        HTTPStatus.METHOD_NOT_ALLOWED: (
            "method_not_allowed",
            "The request method is not supported for this resource.",
        ),
        HTTPStatus.NOT_ACCEPTABLE: (
            "not_acceptable",
            "The request cannot be served in the requested format.",
        ),
        HTTPStatus.CONFLICT: (
            "conflict",
            "The request conflicts with the current resource state.",
        ),
        HTTPStatus.UNSUPPORTED_MEDIA_TYPE: (
            "unsupported_media_type",
            "The request content type is not supported.",
        ),
    }
    return known_errors.get(
        status_code,
        ("invalid_request", "The request could not be completed."),
    )
