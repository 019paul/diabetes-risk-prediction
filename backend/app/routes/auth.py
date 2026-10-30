from flask import Blueprint, g, jsonify

from ..auth import require_authenticated_user


auth_blueprint = Blueprint("auth", __name__)


@auth_blueprint.get("/api/auth/me")
@require_authenticated_user
def authenticated_identity():
    return jsonify(
        status="authenticated",
        user={"id": g.verified_user_id},
    )
