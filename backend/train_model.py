import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import (
    StratifiedKFold,
    cross_validate,
    train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from app.validation import (
    CATEGORICAL_COLUMNS,
    FEATURE_COLUMNS,
    NUMERIC_COLUMNS,
)


TARGET_COLUMN = "diabetes_diagnosis"
PARTICIPANT_ID_COLUMN = "SEQN"
TARGET_NAME = "self_reported_previous_diabetes_diagnosis"
TARGET_LABELS = {
    "0": "No self-reported previous diabetes diagnosis",
    "1": "Yes, self-reported previous diabetes diagnosis",
}
COMPARISON_FEATURE_SETS = {
    "baseline_all_eight": FEATURE_COLUMNS,
    "reduced_without_fasting_glucose_and_hba1c": [
        column
        for column in FEATURE_COLUMNS
        if column not in {"fasting_glucose", "hba1c"}
    ],
}
COMPARISON_SCORING = {
    "accuracy": "accuracy",
    "precision": "precision",
    "recall": "recall",
    "f1": "f1",
    "roc_auc": "roc_auc",
}


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Train and evaluate the approved Random Forest task from an already "
            "prepared complete-case CSV. This command never downloads NHANES."
        )
    )
    parser.add_argument("--input", required=True, help="Prepared CSV path")
    parser.add_argument(
        "--output",
        default="model_artifacts",
        help="Output directory (refuses to overwrite existing model artifacts)",
    )
    parser.add_argument(
        "--compare-feature-sets",
        action="store_true",
        help=(
            "Compare the eight-feature baseline with a model excluding fasting "
            "glucose and HbA1c; writes a separate JSON report, not serving artifacts"
        ),
    )
    parser.add_argument(
        "--comparison-output",
        default="research_results/feature_comparison.json",
        help="Comparison JSON path (refuses to overwrite an existing report)",
    )
    return parser.parse_args()


def build_pipeline(feature_columns=FEATURE_COLUMNS, n_estimators=500, random_state=42):
    feature_columns = list(feature_columns)
    if not feature_columns or len(feature_columns) != len(set(feature_columns)):
        raise ValueError("The pipeline requires a non-empty list of unique features.")
    unexpected = set(feature_columns) - set(FEATURE_COLUMNS)
    if unexpected:
        raise ValueError(
            "Unsupported model feature(s): " + ", ".join(sorted(unexpected)) + "."
        )

    numeric_columns = [
        column for column in NUMERIC_COLUMNS if column in feature_columns
    ]
    categorical_columns = [
        column for column in CATEGORICAL_COLUMNS if column in feature_columns
    ]
    preprocessing = ColumnTransformer(
        transformers=[
            ("numeric", "passthrough", numeric_columns),
            (
                "categorical",
                OneHotEncoder(handle_unknown="ignore"),
                categorical_columns,
            ),
        ],
        remainder="drop",
    )
    classifier = RandomForestClassifier(
        n_estimators=n_estimators,
        random_state=random_state,
        n_jobs=-1,
    )
    return Pipeline(
        steps=[("preprocessor", preprocessing), ("classifier", classifier)]
    )


def compare_feature_sets(features, target, n_estimators=500, random_state=42):
    counts = target.value_counts().reindex([0, 1], fill_value=0)
    if counts.min() < 5:
        raise ValueError(
            "At least five complete-case records per target class are required "
            "for a stratified holdout and cross-validation. No comparison was run."
        )

    row_indices = np.arange(len(target))
    train_indices, test_indices = train_test_split(
        row_indices,
        test_size=0.2,
        random_state=random_state,
        stratify=target,
    )
    y_train = target.iloc[train_indices]
    y_test = target.iloc[test_indices]
    fold_count = min(5, int(y_train.value_counts().min()))
    cross_validation = StratifiedKFold(
        n_splits=fold_count, shuffle=True, random_state=random_state
    )
    shared_folds = list(cross_validation.split(train_indices, y_train))

    def class_counts(values):
        counts_by_class = values.value_counts().reindex([0, 1], fill_value=0)
        return {
            TARGET_LABELS[str(label)]: int(counts_by_class.loc[label])
            for label in (0, 1)
        }

    model_results = {}
    for model_name, feature_columns in COMPARISON_FEATURE_SETS.items():
        x_train = features.iloc[train_indices].loc[:, feature_columns]
        x_test = features.iloc[test_indices].loc[:, feature_columns]
        pipeline = build_pipeline(
            feature_columns,
            n_estimators=n_estimators,
            random_state=random_state,
        )
        cv_results = cross_validate(
            pipeline,
            x_train,
            y_train,
            cv=shared_folds,
            scoring=COMPARISON_SCORING,
            n_jobs=-1,
            error_score="raise",
        )
        pipeline.fit(x_train, y_train)
        predicted = pipeline.predict(x_test)
        probabilities = pipeline.predict_proba(x_test)[:, 1]
        metrics = {
            "accuracy": float(accuracy_score(y_test, predicted)),
            "precision": float(precision_score(y_test, predicted, zero_division=0)),
            "recall": float(recall_score(y_test, predicted, zero_division=0)),
            "f1": float(f1_score(y_test, predicted, zero_division=0)),
            "roc_auc": float(roc_auc_score(y_test, probabilities)),
        }
        cv_metrics = {
            metric: {
                "mean": float(np.mean(cv_results[f"test_{metric}"])),
                "std": float(np.std(cv_results[f"test_{metric}"], ddof=1)),
            }
            for metric in COMPARISON_SCORING
        }
        model_results[model_name] = {
            "features": feature_columns,
            "feature_count": len(feature_columns),
            "holdout": {
                "n": int(len(y_test)),
                "class_counts": class_counts(y_test),
                "metrics": metrics,
                "confusion_matrix_labels": ["documented_no", "documented_yes"],
                "confusion_matrix": confusion_matrix(
                    y_test, predicted, labels=[0, 1]
                ).tolist(),
                "classification_report": classification_report(
                    y_test,
                    predicted,
                    labels=[0, 1],
                    target_names=[TARGET_LABELS["0"], TARGET_LABELS["1"]],
                    output_dict=True,
                    zero_division=0,
                ),
            },
            "training_cross_validation": {
                "folds": fold_count,
                "metrics": cv_metrics,
            },
        }

    return {
        "experiment": "targeted_feature_exclusion_comparison",
        "target": TARGET_NAME,
        "objective": "Classify self-reported previous diabetes diagnosis.",
        "selection_method": (
            "A priori feature-exclusion comparison; SHAP attribution is not "
            "used as a feature-selection method."
        ),
        "dataset": "NHANES 2017-2018 complete-case analytic sample",
        "analytic_sample_n": int(len(target)),
        "analytic_sample_class_counts": class_counts(target),
        "model": "RandomForestClassifier",
        "library_versions": {
            "python": sys.version.split()[0],
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "scikit_learn": sklearn.__version__,
        },
        "model_parameters": {
            "n_estimators": n_estimators,
            "random_state": random_state,
        },
        "evaluation_design": {
            "holdout": "shared stratified 80/20 split",
            "cross_validation": (
                "shared stratified folds on training partition only"
            ),
            "cross_validation_folds": fold_count,
            "preprocessing_fit_scope": (
                "fit independently within each training fold and training partition"
            ),
            "metrics_are_unweighted": True,
            "training_set": {
                "n": int(len(y_train)),
                "class_counts": class_counts(y_train),
            },
            "test_set": {
                "n": int(len(y_test)),
                "class_counts": class_counts(y_test),
            },
        },
        "models": model_results,
        "limitations": [
            "The target is self-reported previous diagnosis, not future diabetes.",
            "Fasting glucose and HbA1c may be related to diagnosis or its ascertainment.",
            "The shared complete-case cohort requires glucose and HbA1c to be present even for the reduced-feature model; it does not establish performance in a broader population without laboratory measurements.",
            "The data are from US NHANES 2017-2018 and are not automatically representative of Nigeria.",
            "Metrics are unweighted and describe only this held-out complete-case analytic sample.",
            "A single holdout split is subject to sampling variability; no confidence intervals or hypothesis tests were estimated.",
            "SHAP explains model outputs; attribution is not causal evidence or feature selection.",
        ],
    }


def save_comparison_report(comparison, output_path):
    output_path = Path(output_path)
    if output_path.exists():
        raise FileExistsError(
            f"{output_path} already exists. Choose a new comparison output path; "
            "this command will not overwrite prior research results."
        )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("x", encoding="utf-8") as file:
        json.dump(comparison, file, indent=2, allow_nan=False)


def load_prepared_data(path):
    frame = pd.read_csv(path)
    expected = set(FEATURE_COLUMNS + [TARGET_COLUMN, PARTICIPANT_ID_COLUMN])
    if set(frame.columns) != expected:
        missing = sorted(expected - set(frame.columns))
        extra = sorted(set(frame.columns) - expected)
        details = []
        if missing:
            details.append("missing columns: " + ", ".join(missing))
        if extra:
            details.append("unexpected columns: " + ", ".join(extra))
        raise ValueError("CSV schema must match the modeling fields (" + "; ".join(details) + ").")
    if frame.empty:
        raise ValueError("CSV contains no participant records.")
    if frame.isna().any().any():
        raise ValueError(
            "Complete-case input is required; remove and report incomplete records "
            "during the separately approved data-preparation stage. No values are imputed."
        )
    participant_ids = pd.to_numeric(frame[PARTICIPANT_ID_COLUMN], errors="raise")
    if not np.isfinite(participant_ids.to_numpy(dtype=float)).all():
        raise ValueError("SEQN values must be finite participant identifiers.")
    if not (participant_ids % 1 == 0).all():
        raise ValueError("SEQN values must be integer participant identifiers.")
    if participant_ids.duplicated().any():
        raise ValueError(
            "Each SEQN must occur once after the approved component-file joins. "
            "Resolve duplicate participants before splitting."
        )

    frame["age"] = pd.to_numeric(frame["age"], errors="raise")
    for column in ("bmi", "fasting_glucose", "hba1c"):
        frame[column] = pd.to_numeric(frame[column], errors="raise")
    if not np.isfinite(frame[NUMERIC_COLUMNS].to_numpy(dtype=float)).all():
        raise ValueError("Numeric feature values must be finite.")
    target = pd.to_numeric(frame[TARGET_COLUMN], errors="raise")
    if not set(target.unique()).issubset({0, 1}):
        raise ValueError(
            "diabetes_diagnosis must contain only 0 (documented no) or 1 "
            "(documented yes); do not map refused, unknown, borderline, or invalid values to no."
        )
    if not frame["age"].between(20, 120).all():
        raise ValueError("Only participants aged 20 or older are eligible.")
    if (frame[["bmi", "fasting_glucose", "hba1c"]] <= 0).any().any():
        raise ValueError("BMI, fasting_glucose, and hba1c must be positive values.")

    for column, allowed in {
        "sex": {"Female", "Male"},
        "hypertension": {"Yes", "No"},
        "heart_disease": {"Yes", "No"},
        "smoking_history": {"Never", "Former", "Current"},
    }.items():
        if not set(frame[column].unique()).issubset(allowed):
            raise ValueError(f"{column} contains values outside the approved categories.")

    return frame[FEATURE_COLUMNS], target.astype(int)


def evaluate_and_save(features, target, output_dir):
    counts = target.value_counts().reindex([0, 1], fill_value=0)
    if counts.min() < 5:
        raise ValueError(
            "At least five complete-case records per target class are required "
            "for a stratified holdout and cross-validation. No model was trained."
        )

    x_train, x_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=0.2,
        random_state=42,
        stratify=target,
    )
    fold_count = min(5, int(y_train.value_counts().min()))
    cross_validation = StratifiedKFold(
        n_splits=fold_count, shuffle=True, random_state=42
    )
    pipeline = build_pipeline()
    cv_results = cross_validate(
        pipeline,
        x_train,
        y_train,
        cv=cross_validation,
        scoring={"f1": "f1", "roc_auc": "roc_auc"},
        n_jobs=-1,
        error_score="raise",
    )
    pipeline.fit(x_train, y_train)
    predicted = pipeline.predict(x_test)
    probabilities = pipeline.predict_proba(x_test)[:, 1]
    metrics = {
        "accuracy": float(accuracy_score(y_test, predicted)),
        "precision": float(precision_score(y_test, predicted, zero_division=0)),
        "recall": float(recall_score(y_test, predicted, zero_division=0)),
        "f1": float(f1_score(y_test, predicted, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, probabilities)),
    }

    output_dir = Path(output_dir)
    bundle_path = output_dir / "model_bundle.joblib"
    evaluation_path = output_dir / "evaluation.json"
    if bundle_path.exists() or evaluation_path.exists():
        raise FileExistsError(
            f"{output_dir} already contains model artifacts. Choose a new directory; "
            "this script will not overwrite existing artifacts."
        )
    output_dir.mkdir(parents=True, exist_ok=True)

    model_version = datetime.now(timezone.utc).strftime("rf-%Y%m%dT%H%M%SZ")
    evaluation = {
        "artifact_schema_version": 1,
        "model_version": model_version,
        "target": TARGET_NAME,
        "target_labels": TARGET_LABELS,
        "objective": "Classify self-reported previous diabetes diagnosis.",
        "model": "RandomForestClassifier",
        "library_versions": {"scikit_learn": sklearn.__version__},
        "input_feature_columns": FEATURE_COLUMNS,
        "complete_case_analytic_sample_n": int(len(target)),
        "target_class_counts": {
            TARGET_LABELS[str(label)]: int(counts.loc[label])
            for label in (0, 1)
        },
        "evaluation": {
            "metrics": metrics,
            "cross_validation_training_only": {
                "folds": fold_count,
                "f1_mean": float(np.mean(cv_results["test_f1"])),
                "f1_std": float(np.std(cv_results["test_f1"], ddof=1)),
                "roc_auc_mean": float(np.mean(cv_results["test_roc_auc"])),
                "roc_auc_std": float(np.std(cv_results["test_roc_auc"], ddof=1)),
            },
            "test_set": {
                "n": int(len(y_test)),
                "class_counts": {
                    TARGET_LABELS[str(label)]: int((y_test == label).sum())
                    for label in (0, 1)
                },
                "confusion_matrix_labels": ["documented_no", "documented_yes"],
                "confusion_matrix": confusion_matrix(y_test, predicted, labels=[0, 1]).tolist(),
                "classification_report": classification_report(
                    y_test,
                    predicted,
                    labels=[0, 1],
                    target_names=[TARGET_LABELS["0"], TARGET_LABELS["1"]],
                    output_dict=True,
                    zero_division=0,
                ),
            },
            "split": {
                "method": "stratified train/test split",
                "test_fraction": 0.2,
                "random_state": 42,
                "preprocessing_fit_scope": "training folds and training partition only",
                "weights": "unweighted",
            },
            "generalizability": (
                "Metrics describe this held-out complete-case analytic sample; "
                "they are not nationally representative estimates."
            ),
        },
        "limitations": [
            "The target is self-reported previous diabetes diagnosis, not future diabetes.",
            "Self-report may not identify participants with undiagnosed diabetes.",
            "Glucose and HbA1c may be related to diagnosis and require discussion as potential diagnostic leakage or ascertainment-related predictors.",
            "No feature attribution demonstrates causation or clinical significance.",
        ],
    }
    joblib.dump(
        {
            "pipeline": pipeline,
            "feature_columns": FEATURE_COLUMNS,
            "model_version": model_version,
        },
        bundle_path,
    )
    evaluation["model_artifact_sha256"] = hashlib.sha256(
        bundle_path.read_bytes()
    ).hexdigest()
    with evaluation_path.open("x", encoding="utf-8") as file:
        json.dump(evaluation, file, indent=2, allow_nan=False)


def main():
    args = parse_args()
    try:
        features, target = load_prepared_data(args.input)
        if args.compare_feature_sets:
            comparison = compare_feature_sets(features, target)
            save_comparison_report(comparison, args.comparison_output)
            print(
                "Feature comparison report saved under "
                f"{Path(args.comparison_output).resolve()}"
            )
            print(
                "Both models use the same split. Results are unweighted and "
                "not nationally representative estimates."
            )
            return 0
        evaluate_and_save(features, target, args.output)
    except (OSError, ValueError, FileExistsError, ImportError) as error:
        print(f"Training stopped: {error}", file=sys.stderr)
        return 1
    print(f"Trained model and held-out evaluation saved under {Path(args.output).resolve()}")
    print("Metrics are unweighted and are not nationally representative estimates.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
