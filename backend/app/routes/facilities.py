import json
import math
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import Blueprint, current_app, jsonify, request

from ..logging_config import log_safe_error


facilities_blueprint = Blueprint("facilities", __name__)


@facilities_blueprint.post("/api/facilities/nearby")
def nearby_facilities():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify(
            status="invalid",
            error="invalid_location",
            message="Provide latitude and longitude as a JSON object.",
        ), 400

    try:
        latitude = float(payload["latitude"])
        longitude = float(payload["longitude"])
    except (KeyError, TypeError, ValueError):
        return jsonify(
            status="invalid",
            error="invalid_location",
            message="Provide valid latitude and longitude coordinates.",
        ), 400
    if (
        not math.isfinite(latitude)
        or not math.isfinite(longitude)
        or not -90 <= latitude <= 90
        or not -180 <= longitude <= 180
    ):
        return jsonify(
            status="invalid",
            error="invalid_location",
            message="Latitude or longitude is outside its valid range.",
        ), 400

    api_key = current_app.config["HFR_API_KEY"]
    if not api_key:
        return jsonify(
            status="unavailable",
            error="facility_registry_key_missing",
            message=(
                "Official facility registration search needs an approved "
                "Nigeria Health Facility Registry API key."
            ),
        ), 503

    parameters = urlencode(
        {
            "near": f"{latitude}|{longitude}|5|km",
            "has_coordinates": "true",
            "per_page": 100,
            "page": 1,
        }
    )
    upstream_request = Request(
        f"https://backend.hfr.fmohconnect.gov.ng/api/v1/facilities?{parameters}",
        headers={
            "Accept": "application/json",
            "User-Agent": "FaithClinicResearch/1.0",
            "X-API-Key": api_key,
        },
    )

    try:
        with urlopen(upstream_request, timeout=15) as response:
            data = json.load(response)
    except HTTPError:
        log_safe_error(current_app.logger, "facility_registry_http_error")
        return jsonify(
            status="unavailable",
            error="facility_registry_request_failed",
            message="The official facility registry could not complete this search.",
        ), 503
    except (TimeoutError, URLError, OSError, json.JSONDecodeError):
        log_safe_error(current_app.logger, "facility_registry_request_failed")
        return jsonify(
            status="unavailable",
            error="facility_registry_unavailable",
            message="The official facility registry is temporarily unavailable.",
        ), 503

    response_data = data.get("data") if isinstance(data, dict) else None
    records = response_data.get("facilities") if isinstance(response_data, dict) else None
    if not isinstance(data, dict) or data.get("status") != "success" or not isinstance(records, list):
        log_safe_error(current_app.logger, "facility_registry_invalid_response")
        return jsonify(
            status="unavailable",
            error="facility_registry_invalid_response",
            message="The official facility registry returned an unusable response.",
        ), 503

    facilities = []
    for record in records:
        if not isinstance(record, dict):
            continue
        location = record.get("location") or {}
        if not isinstance(location, dict):
            continue
        try:
            facility_latitude = float(location["latitude"])
            facility_longitude = float(location["longitude"])
        except (KeyError, TypeError, ValueError):
            continue
        if (
            not math.isfinite(facility_latitude)
            or not math.isfinite(facility_longitude)
            or not -90 <= facility_latitude <= 90
            or not -180 <= facility_longitude <= 180
        ):
            continue

        latitude_delta = math.radians(facility_latitude - latitude)
        longitude_delta = math.radians(facility_longitude - longitude)
        haversine = (
            math.sin(latitude_delta / 2) ** 2
            + math.cos(math.radians(latitude))
            * math.cos(math.radians(facility_latitude))
            * math.sin(longitude_delta / 2) ** 2
        )
        distance = 6371 * 2 * math.atan2(
            math.sqrt(haversine), math.sqrt(1 - haversine)
        )
        if distance > 5 or not record.get("facility_name"):
            continue

        state_data = location.get("state") or {}
        state = state_data.get("name", "") if isinstance(state_data, dict) else ""
        lga_data = location.get("lga") or {}
        lga = lga_data.get("name", "") if isinstance(lga_data, dict) else ""
        address_data = record.get("address")
        if isinstance(address_data, dict):
            address_data = address_data.get("full") or address_data.get("line")
        address = address_data if isinstance(address_data, str) else ""
        if not address:
            address = ", ".join(value for value in (lga, state) if value)
        status = record.get("status") or {}
        if not isinstance(status, dict):
            status = {}
        registration = status.get("registration") or {}
        if not isinstance(registration, dict):
            registration = {}
        operational = status.get("operational") or {}
        if not isinstance(operational, dict):
            operational = {}
        contact = record.get("contact") or {}
        if not isinstance(contact, dict):
            contact = {}
        facility_id = record.get("id") or record.get("unique_id")
        facilities.append(
            {
                "id": str(
                    facility_id
                    or f"{record['facility_name']}-{facility_latitude}-{facility_longitude}"
                ),
                "name": record["facility_name"],
                "address": address,
                "distance": distance,
                "latitude": facility_latitude,
                "longitude": facility_longitude,
                "phone": contact.get("phone_number") or "",
                "registrationStatus": registration.get("name") or "Not specified",
                "registered": (registration.get("name") or "").casefold()
                == "registered",
                "operationalStatus": operational.get("name") or "Not specified",
                "updatedAt": record.get("updated_at") or "",
                "mapUrl": "https://hfr.fmohconnect.gov.ng/",
                "directionsUrl": (
                    "https://www.google.com/maps/dir/?api=1&destination="
                    f"{facility_latitude},{facility_longitude}"
                ),
            }
        )

    facilities.sort(key=lambda facility: (not facility["registered"], facility["distance"]))
    return jsonify(
        status="ready",
        source="Nigeria Health Facility Registry",
        radius_km=5,
        facilities=facilities[:30],
    )
