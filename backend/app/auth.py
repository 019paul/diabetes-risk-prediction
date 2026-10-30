import json
import re
import uuid
from functools import wraps
from http import HTTPStatus
from typing import Any, Callable, TypeVar, cast
from urllib.error import HTTPError, URLError
from urllib.request import (
    HTTPRedirectHandler,
    Request,
    build_opener,
)

from flask import current_app, g, jsonify, request

from .logging_config import log_safe_error


MAX_AUTH_RESPONSE_BYTES = 64 * 1024
MAX_ACCESS_TOKEN_LENGTH = 8192
_COMPACT_JWT_PATTERN = re.compile(r"^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$")
_PROTECTED_MESSAGE = "A valid sign-in is required for this request."
_UNAVAILABLE_MESSAGE = "Authentication could not be verified right now."
_F = TypeVar("_F", bound=Callable[..., Any])


class InvalidAccessToken(Exception):
    """The Supabase Auth service rejected the access token."""


class AuthenticationUnavailable(Exception):
    """The Supabase Auth service could not verify the access token."""


class _NoRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, new_url):
        del req, fp, code, msg, headers, new_url
        return None


def _open_auth_request(auth_request: Request, timeout: int):
    opener = build_opener(_NoRedirectHandler)
    return opener.open(auth_request, timeout=timeout)


def verify_supabase_access_token(
    access_token: str,
    *,
    supabase_url: str,
    anon_key: str,
    timeout: int,
) -> str:
    auth_request = Request(
        f"{supabase_url.rstrip('/')}/auth/v1/user",
        headers={
            "Accept": "application/json",
            "apikey": anon_key,
            "Authorization": f"Bearer {access_token}",
        },
        method="GET",
    )
    try:
        with _open_auth_request(auth_request, timeout) as response:
            if response.getcode() != HTTPStatus.OK:
                raise AuthenticationUnavailable
            response_body = response.read(MAX_AUTH_RESPONSE_BYTES + 1)
    except HTTPError as error:
        if error.code in {HTTPStatus.UNAUTHORIZED, HTTPStatus.FORBIDDEN}:
            error.close()
            raise InvalidAccessToken from None
        error.close()
        raise AuthenticationUnavailable from None
    except (TimeoutError, URLError, OSError):
        raise AuthenticationUnavailable from None

    if len(response_body) > MAX_AUTH_RESPONSE_BYTES:
        raise AuthenticationUnavailable
    try:
        user = json.loads(response_body)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise AuthenticationUnavailable from None
    if not isinstance(user, dict) or not isinstance(user.get("id"), str):
        raise AuthenticationUnavailable
    try:
        user_id = str(uuid.UUID(user["id"]))
    except ValueError:
        raise AuthenticationUnavailable from None

    return user_id


def _bearer_token() -> str | None:
    authorization = request.headers.get("Authorization", "")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].casefold() != "bearer":
        return None
    token = parts[1]
    if (
        len(token) > MAX_ACCESS_TOKEN_LENGTH
        or not _COMPACT_JWT_PATTERN.fullmatch(token)
    ):
        return None
    return token


def require_authenticated_user(function: _F) -> _F:
    @wraps(function)
    def wrapped(*args, **kwargs):
        token = _bearer_token()
        if token is None:
            return _unauthorized_response()

        supabase_url = current_app.config.get("SUPABASE_URL")
        anon_key = current_app.config.get("SUPABASE_ANON_KEY")
        if not supabase_url or not anon_key:
            log_safe_error(current_app.logger, "supabase_auth_not_configured")
            return _unavailable_response()

        try:
            user_id = verify_supabase_access_token(
                token,
                supabase_url=supabase_url,
                anon_key=anon_key,
                timeout=current_app.config["SUPABASE_AUTH_TIMEOUT_SECONDS"],
            )
        except InvalidAccessToken:
            return _unauthorized_response()
        except AuthenticationUnavailable:
            log_safe_error(current_app.logger, "supabase_auth_verification_failed")
            return _unavailable_response()

        g.verified_user_id = user_id
        return function(*args, **kwargs)

    return cast(_F, wrapped)


def require_staff_access(function: _F) -> _F:
    @require_authenticated_user
    @wraps(function)
    def deny_unprovisioned_staff_access(*_args, **_kwargs):
        del _args, _kwargs
        return jsonify(
            status="forbidden",
            error="staff_authorization_not_configured",
            message="Staff access is unavailable until an approved authorization mechanism is configured.",
        ), HTTPStatus.FORBIDDEN

    return cast(_F, deny_unprovisioned_staff_access)


def _unauthorized_response():
    return jsonify(
        status="unauthorized",
        error="authentication_required",
        message=_PROTECTED_MESSAGE,
    ), HTTPStatus.UNAUTHORIZED


def _unavailable_response():
    return jsonify(
        status="unavailable",
        error="authentication_unavailable",
        message=_UNAVAILABLE_MESSAGE,
    ), HTTPStatus.SERVICE_UNAVAILABLE
