import hashlib
import json
import math
import pickle
import threading


class ModelRegistry:
    def __init__(self, artifact_dir):
        self.artifact_dir = artifact_dir
        self._lock = threading.Lock()
        self._cached_signature = None
        self._cached_result = (None, None)

    def load(self):
        bundle_path = self.artifact_dir / "model_bundle.joblib"
        evaluation_path = self.artifact_dir / "evaluation.json"
        if not bundle_path.is_file() or not evaluation_path.is_file():
            return (
                None,
                "The model bundle and evaluation metadata are missing from the configured artifact directory.",
            )

        signature = (
            bundle_path.stat().st_mtime_ns,
            bundle_path.stat().st_size,
            evaluation_path.stat().st_mtime_ns,
            evaluation_path.stat().st_size,
        )
        with self._lock:
            if signature == self._cached_signature:
                return self._cached_result

            try:
                import joblib

                bundle = joblib.load(bundle_path)
                with evaluation_path.open(encoding="utf-8") as file:
                    evaluation = json.load(file)
                self._validate_bundle(bundle, evaluation, bundle_path)
            except ImportError:
                result = (
                    None,
                    "Optional model runtime dependencies are missing. Install backend/requirements-ml.txt.",
                )
            except (
                AttributeError,
                EOFError,
                KeyError,
                OSError,
                pickle.UnpicklingError,
                TypeError,
                ValueError,
            ) as error:
                result = (None, f"Model artifacts are invalid: {type(error).__name__}.")
            else:
                result = (
                    {
                        "pipeline": bundle["pipeline"],
                        "feature_columns": bundle["feature_columns"],
                        "model_version": bundle["model_version"],
                        "evaluation": evaluation,
                    },
                    None,
                )
            self._cached_signature = signature
            self._cached_result = result
            return result

    @staticmethod
    def _validate_bundle(bundle, evaluation, bundle_path):
        from .validation import FEATURE_COLUMNS

        if not isinstance(bundle, dict) or not isinstance(evaluation, dict):
            raise ValueError("Artifact files must contain JSON and a model bundle.")
        if bundle.get("feature_columns") != FEATURE_COLUMNS:
            raise ValueError("Feature schema does not match the application.")
        if not isinstance(bundle.get("model_version"), str) or not bundle["model_version"]:
            raise ValueError("Model version is missing.")
        if evaluation.get("artifact_schema_version") != 1:
            raise ValueError("Evaluation artifact schema is unsupported.")
        if evaluation.get("model_version") != bundle["model_version"]:
            raise ValueError("Model and evaluation versions do not match.")
        expected_digest = evaluation.get("model_artifact_sha256")
        digest = hashlib.sha256(bundle_path.read_bytes()).hexdigest()
        if expected_digest != digest:
            raise ValueError("Evaluation record does not match the model artifact.")
        if evaluation.get("target") != "self_reported_previous_diabetes_diagnosis":
            raise ValueError("Evaluation target does not match the approved objective.")
        model = bundle.get("pipeline")
        if not hasattr(model, "predict") or not hasattr(model, "named_steps"):
            raise ValueError("The pipeline artifact is invalid.")
        if not hasattr(model.named_steps.get("classifier"), "classes_"):
            raise ValueError("The classifier has not been fitted.")
        if model.named_steps["classifier"].classes_.tolist() != [0, 1]:
            raise ValueError("The fitted model classes do not match the target encoding.")
        if "evaluation" not in evaluation or "metrics" not in evaluation["evaluation"]:
            raise ValueError("Held-out evaluation metrics are missing.")
        metrics = evaluation["evaluation"]["metrics"]
        for name in ("accuracy", "precision", "recall", "f1", "roc_auc"):
            metric = metrics.get(name)
            if (
                not isinstance(metric, (int, float))
                or not math.isfinite(metric)
                or not 0 <= metric <= 1
            ):
                raise ValueError(f"Evaluation metric {name} is missing or invalid.")
        if evaluation["evaluation"].get("split", {}).get("weights") != "unweighted":
            raise ValueError("The evaluation artifact does not use approved unweighted metrics.")
        test_size = evaluation["evaluation"].get("test_set", {}).get("n")
        if not isinstance(test_size, int) or test_size < 1:
            raise ValueError("Held-out evaluation sample size is missing or invalid.")

    @staticmethod
    def explain(bundle, features):
        import numpy as np
        import pandas as pd
        import shap
        from scipy import sparse

        pipeline = bundle["pipeline"]
        preprocessor = pipeline.named_steps["preprocessor"]
        classifier = pipeline.named_steps["classifier"]
        row = pd.DataFrame(
            [[features[column] for column in bundle["feature_columns"]]],
            columns=bundle["feature_columns"],
        )
        transformed = preprocessor.transform(row)
        if sparse.issparse(transformed):
            transformed = transformed.toarray()
        explainer = shap.TreeExplainer(
            classifier,
            feature_perturbation="tree_path_dependent",
            model_output="raw",
        )
        shap_values = explainer.shap_values(transformed)
        classes = [int(value) for value in classifier.classes_]
        predicted_class = int(pipeline.predict(row)[0])
        class_index = classes.index(predicted_class)
        contributions, base_value = _select_class_values(
            shap_values, explainer.expected_value, class_index, len(classes)
        )

        transformed_names = preprocessor.get_feature_names_out()
        aggregated = {name: 0.0 for name in bundle["feature_columns"]}
        for name, value in zip(transformed_names, contributions, strict=True):
            unprefixed = name.split("__", maxsplit=1)[-1]
            source_feature = next(
                (
                    column
                    for column in bundle["feature_columns"]
                    if unprefixed == column or unprefixed.startswith(f"{column}_")
                ),
                None,
            )
            if source_feature is None:
                raise ValueError("SHAP feature names do not match the input schema.")
            aggregated[source_feature] += float(value)

        class_labels = {
            0: "No self-reported previous diabetes diagnosis",
            1: "Yes, self-reported previous diabetes diagnosis",
        }
        probabilities = pipeline.predict_proba(row)[0]
        return {
            "status": "ready",
            "predicted_class": class_labels[predicted_class],
            "predicted_class_probability": float(probabilities[class_index]),
            "model_version": bundle["model_version"],
            "attribution_scale": "random forest raw output",
            "base_value": float(base_value),
            "feature_contributions": [
                {"feature": name, "shap_value": value}
                for name, value in sorted(
                    aggregated.items(), key=lambda item: abs(item[1]), reverse=True
                )
            ],
            "interpretation": (
                "SHAP contributions explain this model output. They are not causal "
                "effects or measures of clinical significance."
            ),
        }


def _select_class_values(values, expected_value, class_index, class_count):
    import numpy as np

    if isinstance(values, list):
        selected = np.asarray(values[class_index])[0]
    else:
        array = np.asarray(values)
        if array.ndim == 3:
            selected = array[0, :, class_index] if array.shape[-1] == class_count else array[class_index, 0, :]
        elif array.ndim == 2:
            selected = array[0]
        else:
            raise ValueError("Unexpected SHAP output dimensions.")

    expected = np.asarray(expected_value)
    if expected.ndim == 0:
        base_value = expected.item()
    elif expected.size == class_count:
        base_value = expected.reshape(-1)[class_index]
    else:
        raise ValueError("Unexpected SHAP base value dimensions.")
    return selected, base_value
