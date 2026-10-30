from dataclasses import asdict, dataclass
from importlib import import_module
from typing import Any, Callable


@dataclass(frozen=True)
class DatabaseReadiness:
    status: str
    configured: bool
    error: str | None = None
    message: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def check_database_connection(
    database_url: str | None,
    connect_timeout: int,
    connector: Callable[..., Any] | None = None,
) -> DatabaseReadiness:
    if not database_url:
        return DatabaseReadiness(
            status="not_configured",
            configured=False,
            message="Database connectivity is not configured.",
        )

    try:
        psycopg = import_module("psycopg")
    except ImportError:
        return DatabaseReadiness(
            status="unavailable",
            configured=True,
            error="database_driver_unavailable",
            message="The PostgreSQL driver is not installed.",
        )

    connect = connector or psycopg.connect
    try:
        with connect(database_url, connect_timeout=connect_timeout) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
        if result != (1,):
            return DatabaseReadiness(
                status="unavailable",
                configured=True,
                error="database_check_failed",
                message="The database connectivity check did not return the expected result.",
            )
    except psycopg.Error:
        return DatabaseReadiness(
            status="unavailable",
            configured=True,
            error="database_unavailable",
            message="The configured database could not be reached.",
        )

    return DatabaseReadiness(status="ready", configured=True)
