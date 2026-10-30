import ipaddress
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping
from urllib.parse import urlsplit

from dotenv import load_dotenv


BACKEND_DIRECTORY = Path(__file__).resolve().parents[1]
DEFAULT_ALLOWED_ORIGINS = (
    "http://127.0.0.1:5173,http://localhost:5173,"
    "http://127.0.0.1:5174,http://localhost:5174"
)


class ConfigurationError(ValueError):
    """Raised when a backend setting is missing or malformed."""


@dataclass(frozen=True)
class BackendSettings:
    flask_host: str
    flask_port: int
    api_allowed_origins: tuple[str, ...]
    model_artifact_dir: str
    max_content_length: int
    database_connect_timeout: int
    database_url: str | None = field(default=None, repr=False)
    hfr_api_key: str | None = field(default=None, repr=False)
    supabase_url: str | None = field(default=None, repr=False)
    supabase_anon_key: str | None = field(default=None, repr=False)
    supabase_auth_timeout: int = 3

    @classmethod
    def from_environment(
        cls,
        environment: Mapping[str, str] | None = None,
        overrides: Mapping[str, object] | None = None,
        backend_directory: Path = BACKEND_DIRECTORY,
    ) -> "BackendSettings":
        load_dotenv(backend_directory / ".env")
        values: dict[str, object] = dict(os.environ if environment is None else environment)
        if overrides:
            values.update(overrides)

        host = _non_empty_string(values, "FLASK_HOST", "127.0.0.1")
        _validate_local_host(host)
        port = _integer_setting(values, "FLASK_PORT", 5000, minimum=1, maximum=65535)
        max_content_length = _integer_setting(
            values, "MAX_CONTENT_LENGTH", 4096, minimum=1
        )
        database_connect_timeout = _integer_setting(
            values,
            "DATABASE_CONNECT_TIMEOUT_SECONDS",
            3,
            minimum=1,
            maximum=30,
        )
        supabase_auth_timeout = _integer_setting(
            values,
            "SUPABASE_AUTH_TIMEOUT_SECONDS",
            3,
            minimum=1,
            maximum=15,
        )
        origins = _allowed_origins(
            _non_empty_string(
                values,
                "API_ALLOWED_ORIGINS",
                DEFAULT_ALLOWED_ORIGINS,
                allow_empty=True,
            )
        )

        model_artifact_dir = _non_empty_string(
            values,
            "MODEL_ARTIFACT_DIR",
            str(backend_directory / "model_artifacts"),
        )
        artifact_path = Path(model_artifact_dir).expanduser()
        if not artifact_path.is_absolute():
            artifact_path = backend_directory / artifact_path

        database_url = _optional_database_url(values)
        hfr_api_key = _optional_secret_string(values, "HFR_API_KEY")
        supabase_url, supabase_anon_key = _optional_supabase_configuration(values)
        return cls(
            flask_host=host,
            flask_port=port,
            api_allowed_origins=origins,
            model_artifact_dir=str(artifact_path.resolve()),
            max_content_length=max_content_length,
            database_connect_timeout=database_connect_timeout,
            database_url=database_url,
            hfr_api_key=hfr_api_key,
            supabase_url=supabase_url,
            supabase_anon_key=supabase_anon_key,
            supabase_auth_timeout=supabase_auth_timeout,
        )

    def to_flask_config(self) -> dict[str, object]:
        return {
            "FLASK_HOST": self.flask_host,
            "FLASK_PORT": self.flask_port,
            "API_ALLOWED_ORIGINS": ",".join(self.api_allowed_origins),
            "MODEL_ARTIFACT_DIR": self.model_artifact_dir,
            "MAX_CONTENT_LENGTH": self.max_content_length,
            "DATABASE_CONNECT_TIMEOUT_SECONDS": self.database_connect_timeout,
            "DATABASE_URL": self.database_url,
            "HFR_API_KEY": self.hfr_api_key,
            "SUPABASE_URL": self.supabase_url,
            "SUPABASE_ANON_KEY": self.supabase_anon_key,
            "SUPABASE_AUTH_TIMEOUT_SECONDS": self.supabase_auth_timeout,
        }


def _non_empty_string(
    values: Mapping[str, object],
    name: str,
    default: str,
    *,
    allow_empty: bool = False,
) -> str:
    value = values.get(name, default)
    if not isinstance(value, str):
        raise ConfigurationError(f"{name} must be a string.")
    normalized = value.strip()
    if not normalized and not allow_empty:
        raise ConfigurationError(f"{name} must not be empty.")
    return normalized


def _integer_setting(
    values: Mapping[str, object],
    name: str,
    default: int,
    *,
    minimum: int,
    maximum: int | None = None,
) -> int:
    value = values.get(name, default)
    if isinstance(value, bool):
        raise ConfigurationError(f"{name} must be an integer.")
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ConfigurationError(f"{name} must be an integer.") from None
    if parsed < minimum or (maximum is not None and parsed > maximum):
        if maximum is None:
            raise ConfigurationError(f"{name} must be at least {minimum}.")
        raise ConfigurationError(
            f"{name} must be between {minimum} and {maximum}."
        )
    return parsed


def _allowed_origins(value: str) -> tuple[str, ...]:
    origins = tuple(origin.strip() for origin in value.split(",") if origin.strip())
    for origin in origins:
        try:
            parsed = urlsplit(origin)
            parsed.port
        except ValueError:
            raise ConfigurationError(
                "API_ALLOWED_ORIGINS contains an invalid origin."
            ) from None
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise ConfigurationError(
                "API_ALLOWED_ORIGINS must contain HTTP(S) origins without paths or credentials."
            )
    return origins


def _validate_local_host(host: str) -> None:
    if host.casefold() == "localhost":
        return
    try:
        is_loopback = ipaddress.ip_address(host).is_loopback
    except ValueError:
        is_loopback = False
    if not is_loopback:
        raise ConfigurationError(
            "FLASK_HOST must be a loopback address; do not bind the development server publicly."
        )


def _optional_database_url(values: Mapping[str, object]) -> str | None:
    value = values.get("DATABASE_URL")
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise ConfigurationError("DATABASE_URL must be a PostgreSQL connection URL.")
    normalized = value.strip()
    try:
        parsed = urlsplit(normalized)
        valid = (
            parsed.scheme in {"postgresql", "postgres"}
            and bool(parsed.hostname)
            and parsed.path not in {"", "/"}
        )
        parsed.port
    except ValueError:
        valid = False
    if not valid:
        raise ConfigurationError("DATABASE_URL must be a PostgreSQL connection URL.")
    return normalized


def _optional_secret_string(values: Mapping[str, object], name: str) -> str | None:
    value = values.get(name)
    if value is None:
        return None
    if not isinstance(value, str):
        raise ConfigurationError(f"{name} must be a string.")
    normalized = value.strip()
    return normalized or None


def _optional_supabase_configuration(
    values: Mapping[str, object],
) -> tuple[str | None, str | None]:
    url = _optional_secret_string(values, "SUPABASE_URL")
    anon_key = _optional_secret_string(values, "SUPABASE_ANON_KEY")
    if bool(url) != bool(anon_key):
        raise ConfigurationError(
            "SUPABASE_URL and SUPABASE_ANON_KEY must be configured together."
        )
    if not url:
        return None, None

    try:
        parsed = urlsplit(url)
        valid = (
            parsed.scheme == "https"
            and bool(parsed.hostname)
            and parsed.username is None
            and parsed.password is None
            and parsed.path in {"", "/"}
            and not parsed.query
            and not parsed.fragment
            and parsed.port in {None, 443}
        )
    except ValueError:
        valid = False
    if not valid:
        raise ConfigurationError(
            "SUPABASE_URL must be an HTTPS project URL without credentials, paths, or query parameters."
        )
    return url.rstrip("/"), anon_key
