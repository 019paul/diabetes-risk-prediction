from .auth import auth_blueprint
from .facilities import facilities_blueprint
from .health import health_blueprint
from .research import research_blueprint


__all__ = [
    "auth_blueprint",
    "facilities_blueprint",
    "health_blueprint",
    "research_blueprint",
]
