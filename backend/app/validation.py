import math


FEATURE_COLUMNS = [
    "age",
    "sex",
    "bmi",
    "hypertension",
    "heart_disease",
    "fasting_glucose",
    "hba1c",
    "smoking_history",
]

CATEGORICAL_COLUMNS = ["sex", "hypertension", "heart_disease", "smoking_history"]
NUMERIC_COLUMNS = ["age", "bmi", "fasting_glucose", "hba1c"]
ALLOWED_VALUES = {
    "sex": {"Female", "Male"},
    "hypertension": {"Yes", "No"},
    "heart_disease": {"Yes", "No"},
    "smoking_history": {"Never", "Former", "Current"},
}


class InputValidationError(ValueError):
    pass


def validate_assessment(payload):
    if not isinstance(payload, dict):
        raise InputValidationError("Provide the assessment fields as a JSON object.")

    unexpected = [field for field in payload if field not in FEATURE_COLUMNS]
    if unexpected:
        raise InputValidationError(
            "Unexpected assessment field(s) are not accepted: "
            + ", ".join(sorted(unexpected))
            + "."
        )

    missing = [field for field in FEATURE_COLUMNS if field not in payload]
    if missing:
        raise InputValidationError(
            "Missing required assessment field(s): " + ", ".join(missing) + "."
        )

    clean = {}
    for field in NUMERIC_COLUMNS:
        value = payload[field]
        if isinstance(value, bool):
            raise InputValidationError(f"{field} must be a finite number.")
        try:
            number = float(value)
        except (TypeError, ValueError):
            raise InputValidationError(f"{field} must be a finite number.") from None
        if not math.isfinite(number):
            raise InputValidationError(f"{field} must be a finite number.")
        if field == "age" and (number < 20 or number > 120):
            raise InputValidationError("age must be between 20 and 120 for this study.")
        if field != "age" and number <= 0:
            raise InputValidationError(f"{field} must be greater than zero.")
        clean[field] = number

    for field, allowed in ALLOWED_VALUES.items():
        value = payload[field]
        if value not in allowed:
            raise InputValidationError(
                f"{field} must be one of: {', '.join(sorted(allowed))}."
            )
        clean[field] = value

    return clean
