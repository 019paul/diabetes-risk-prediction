import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from app.validation import FEATURE_COLUMNS
from train_model import (
    COMPARISON_FEATURE_SETS,
    compare_feature_sets,
    save_comparison_report,
)


class FeatureComparisonTests(unittest.TestCase):
    def make_synthetic_data(self):
        rng = np.random.default_rng(42)
        row_count = 120
        features = pd.DataFrame(
            {
                "age": rng.integers(20, 81, row_count),
                "sex": rng.choice(["Female", "Male"], row_count),
                "bmi": rng.uniform(18, 42, row_count),
                "hypertension": rng.choice(["Yes", "No"], row_count),
                "heart_disease": rng.choice(["Yes", "No"], row_count),
                "fasting_glucose": rng.uniform(70, 180, row_count),
                "hba1c": rng.uniform(4.0, 9.0, row_count),
                "smoking_history": rng.choice(
                    ["Never", "Former", "Current"], row_count
                ),
            }
        )
        target = pd.Series(
            (
                features["age"]
                + features["bmi"]
                + features["fasting_glucose"] / 4
                + rng.normal(0, 12, row_count)
                > 100
            ).astype(int)
        )
        return features, target

    def test_comparison_uses_requested_features_and_reports_both_models(self):
        features, target = self.make_synthetic_data()

        report = compare_feature_sets(
            features,
            target,
            n_estimators=8,
            random_state=42,
        )

        baseline = report["models"]["baseline_all_eight"]
        reduced = report["models"][
            "reduced_without_fasting_glucose_and_hba1c"
        ]
        self.assertEqual(baseline["features"], FEATURE_COLUMNS)
        self.assertEqual(baseline["feature_count"], 8)
        self.assertEqual(
            reduced["features"],
            COMPARISON_FEATURE_SETS[
                "reduced_without_fasting_glucose_and_hba1c"
            ],
        )
        self.assertNotIn("fasting_glucose", reduced["features"])
        self.assertNotIn("hba1c", reduced["features"])
        self.assertEqual(reduced["feature_count"], 6)
        self.assertEqual(baseline["holdout"]["n"], reduced["holdout"]["n"])
        self.assertEqual(
            baseline["holdout"]["class_counts"],
            reduced["holdout"]["class_counts"],
        )
        self.assertEqual(
            baseline["holdout"]["confusion_matrix_labels"],
            ["documented_no", "documented_yes"],
        )
        self.assertEqual(
            len(baseline["holdout"]["confusion_matrix"]),
            2,
        )
        expected_metrics = {"accuracy", "precision", "recall", "f1", "roc_auc"}
        self.assertEqual(set(baseline["holdout"]["metrics"]), expected_metrics)
        self.assertEqual(
            set(baseline["training_cross_validation"]["metrics"]),
            expected_metrics,
        )
        self.assertEqual(
            report["evaluation_design"]["holdout"],
            "shared stratified 80/20 split",
        )
        self.assertIn("US NHANES", " ".join(report["limitations"]))

    def test_comparison_report_refuses_to_overwrite_existing_file(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "comparison.json"
            path.write_text('{"existing": true}', encoding="utf-8")

            with self.assertRaises(FileExistsError):
                save_comparison_report({"new": True}, path)

            self.assertEqual(
                json.loads(path.read_text(encoding="utf-8")),
                {"existing": True},
            )

    def test_comparison_requires_enough_records_in_both_classes(self):
        features, _ = self.make_synthetic_data()
        target = pd.Series([0] * 117 + [1] * 3)

        with self.assertRaisesRegex(ValueError, "At least five"):
            compare_feature_sets(features, target, n_estimators=8)


if __name__ == "__main__":
    unittest.main()
