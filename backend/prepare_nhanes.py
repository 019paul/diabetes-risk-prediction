
from pathlib import Path
import json

import pandas as pd


# --------------------------------------------------
# 1. Define file locations
# --------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parent
RAW_DIR = BACKEND_DIR / "data" / "raw"
OUTPUT_DIR = BACKEND_DIR / "data" / "processed"

OUTPUT_FILE = OUTPUT_DIR / "nhanes_diabetes_complete_case.csv"
AUDIT_FILE = OUTPUT_DIR / "preparation_audit.json"

SOURCE_FILES = [
    "DEMO_J.XPT",
    "DIQ_J.XPT",
    "BMX_J.XPT",
    "GHB_J.XPT",
    "GLU_J.XPT",
    "SMQ_J.XPT",
    "BPQ_J.XPT",
    "MCQ_J.XPT",
]


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    audit = {
        "dataset": "NHANES 2017-2018",
        "target": "self_reported_previous_diabetes_diagnosis",
        "source_rows": {},
        "join_rows": {},
        "exclusions": {},
        "notes": [
            "Complete-case dataset; no imputation performed.",
            "Analysis is restricted to adults aged 20 and older.",
            "Target is self-reported previous diabetes diagnosis.",
            "This dataset is not a clinically validated diagnostic dataset.",
        ],
    }

    # --------------------------------------------------
    # 2. Check and load the eight source files
    # --------------------------------------------------

    missing_files = [
        name for name in SOURCE_FILES
        if not (RAW_DIR / name).is_file()
    ]

    if missing_files:
        raise FileNotFoundError(
            "Missing source files in "
            f"{RAW_DIR}:\n" + "\n".join(missing_files)
        )

    tables = {}

    for filename in SOURCE_FILES:
        path = RAW_DIR / filename

        # NHANES files use SAS transport format.
        df = pd.read_sas(
            path,
            format="xport",
            encoding="infer",
        )

        if "SEQN" not in df.columns:
            raise ValueError(
                f"{filename} does not contain SEQN."
            )

        if df["SEQN"].duplicated().any():
            raise ValueError(
                f"{filename} contains duplicate SEQN values."
            )

        audit["source_rows"][filename] = len(df)
        tables[filename] = df

        print(f"Loaded {filename}: {len(df):,} rows")

    # --------------------------------------------------
    # 3. Select only the required columns
    # --------------------------------------------------

    demo = tables["DEMO_J.XPT"][
        ["SEQN", "RIDAGEYR", "RIAGENDR"]
    ]

    diabetes = tables["DIQ_J.XPT"][
        ["SEQN", "DIQ010"]
    ]

    bmi = tables["BMX_J.XPT"][
        ["SEQN", "BMXBMI"]
    ]

    hba1c = tables["GHB_J.XPT"][
        ["SEQN", "LBXGH"]
    ]

    glucose = tables["GLU_J.XPT"][
        ["SEQN", "LBXGLU"]
    ]

    smoking = tables["SMQ_J.XPT"][
        ["SEQN", "SMQ020", "SMQ040"]
    ]

    blood_pressure = tables["BPQ_J.XPT"][
        ["SEQN", "BPQ020"]
    ]

    heart = tables["MCQ_J.XPT"][
        ["SEQN", "MCQ160C", "MCQ160D", "MCQ160E"]
    ]

    # --------------------------------------------------
    # 4. Join the tables by participant ID
    # --------------------------------------------------

    data = demo

    for name, table in [
        ("diabetes", diabetes),
        ("bmi", bmi),
        ("hba1c", hba1c),
        ("glucose", glucose),
        ("smoking", smoking),
        ("blood_pressure", blood_pressure),
        ("heart", heart),
    ]:
        before = len(data)

        data = data.merge(
            table,
            on="SEQN",
            how="inner",
            validate="one_to_one",
        )

        audit["join_rows"][name] = {
            "rows_before": before,
            "rows_after": len(data),
            "rows_not_matched": before - len(data),
        }

    print(f"\nRows after joining all files: {len(data):,}")

    # --------------------------------------------------
    # 5. Restrict the dataset to adults aged 20+
    # --------------------------------------------------

    data["RIDAGEYR"] = pd.to_numeric(
        data["RIDAGEYR"], errors="coerce"
    )

    before = len(data)
    data = data.loc[data["RIDAGEYR"] >= 20].copy()

    audit["exclusions"]["under_20_or_unknown_age"] = (
        before - len(data)
    )

    # --------------------------------------------------
    # 6. Define the target variable
    # --------------------------------------------------
    # DIQ010:
    # 1 = Yes
    # 2 = No
    # Other values = unknown/borderline/refused/etc.

    data["diabetes_diagnosis"] = data["DIQ010"].map({
        1: 1,
        2: 0,
    })

    before = len(data)
    data = data.loc[
        data["diabetes_diagnosis"].notna()
    ].copy()

    audit["exclusions"]["unknown_diabetes_response"] = (
        before - len(data)
    )

    data["diabetes_diagnosis"] = (
        data["diabetes_diagnosis"].astype(int)
    )

    # --------------------------------------------------
    # 7. Create the eight model features
    # --------------------------------------------------

    data["age"] = data["RIDAGEYR"]

    data["sex"] = data["RIAGENDR"].map({
        1: "Male",
        2: "Female",
    })

    data["bmi"] = data["BMXBMI"]

    data["fasting_glucose"] = data["LBXGLU"]

    data["hba1c"] = data["LBXGH"]

    data["hypertension"] = data["BPQ020"].map({
        1: "Yes",
        2: "No",
    })

    # Heart disease definition:
    # Yes if any of CHD, angina, or heart attack is Yes.
    # No only when all three responses are No.
    # Otherwise, leave as unknown.

    heart_columns = [
        "MCQ160C",
        "MCQ160D",
        "MCQ160E",
    ]

    heart_responses = data[heart_columns]

    any_heart_disease = heart_responses.eq(1).any(axis=1)
    all_heart_disease_no = heart_responses.eq(2).all(axis=1)

    data["heart_disease"] = pd.Series(
        pd.NA, index=data.index, dtype="object"
    )

    data.loc[any_heart_disease, "heart_disease"] = "Yes"

    data.loc[
        all_heart_disease_no, "heart_disease"
    ] = "No"

    # Smoking definition:
    # SMQ020 = 2: never smoked 100 cigarettes.
    # SMQ020 = 1 and SMQ040 = 1 or 2: current smoker.
    # SMQ020 = 1 and SMQ040 = 3: former smoker.
    # Unknown responses remain missing.

    data["smoking_history"] = pd.Series(
        pd.NA, index=data.index, dtype="object"
    )

    data.loc[
        data["SMQ020"].eq(2),
        "smoking_history",
    ] = "Never"

    current_smoker = (
        data["SMQ020"].eq(1)
        & data["SMQ040"].isin([1, 2])
    )

    former_smoker = (
        data["SMQ020"].eq(1)
        & data["SMQ040"].eq(3)
    )

    data.loc[
        current_smoker, "smoking_history"
    ] = "Current"

    data.loc[
        former_smoker, "smoking_history"
    ] = "Former"

    # --------------------------------------------------
    # 8. Keep the exact schema expected by the backend
    # --------------------------------------------------

    feature_columns = [
        "age",
        "sex",
        "bmi",
        "hypertension",
        "heart_disease",
        "fasting_glucose",
        "hba1c",
        "smoking_history",
    ]

    output_columns = [
        "SEQN",
        *feature_columns,
        "diabetes_diagnosis",
    ]

    prepared = data[output_columns].copy()

    # Convert measurement columns to numeric.
    numeric_columns = [
        "age",
        "bmi",
        "fasting_glucose",
        "hba1c",
    ]

    for column in numeric_columns:
        prepared[column] = pd.to_numeric(
            prepared[column], errors="coerce"
        )

    # Replace invalid measurement values with missing values.
    prepared.loc[
        prepared["age"] < 20, "age"
    ] = pd.NA

    for column in ["bmi", "fasting_glucose", "hba1c"]:
        prepared.loc[
            prepared[column] <= 0, column
        ] = pd.NA

    # --------------------------------------------------
    # 9. Audit missing values and make complete cases
    # --------------------------------------------------

    audit["missing_before_complete_case_filter"] = {
        column: int(count)
        for column, count in prepared.isna().sum().items()
    }

    before = len(prepared)

    prepared = prepared.dropna(
        subset=output_columns
    ).copy()

    audit["exclusions"]["incomplete_feature_rows"] = (
        before - len(prepared)
    )

    # Validate participant IDs and target values.
    if prepared["SEQN"].duplicated().any():
        raise ValueError(
            "Duplicate participant IDs found in prepared data."
        )

    if not prepared["diabetes_diagnosis"].isin([0, 1]).all():
        raise ValueError("Unexpected target values found.")

    if prepared.empty:
        raise ValueError(
            "No complete cases remain. Review the audit and definitions."
        )

    if prepared["diabetes_diagnosis"].nunique() != 2:
        raise ValueError(
            "The prepared data does not contain both target classes."
        )

    prepared["SEQN"] = prepared["SEQN"].astype(int)

    # --------------------------------------------------
    # 10. Save the CSV and audit report
    # --------------------------------------------------

    prepared.to_csv(OUTPUT_FILE, index=False)

    audit["final_rows"] = len(prepared)

    audit["target_distribution"] = {
        str(label): int(count)
        for label, count in (
            prepared["diabetes_diagnosis"]
            .value_counts()
            .sort_index()
            .items()
        )
    }

    audit["final_columns"] = list(prepared.columns)

    audit["limitations"] = [
        "Complete-case selection may introduce selection bias.",
        "Fasting glucose is available only for an NHANES subsample.",
        "Results may not represent the entire US population.",
        "Glucose and HbA1c may be closely related to the reported diagnosis.",
        "The outcome records previous self-reported diagnosis, not future diabetes.",
        "Training and evaluation must document their unweighted metrics.",
    ]

    with AUDIT_FILE.open("w", encoding="utf-8") as file:
        json.dump(audit, file, indent=2)

    print("\nDATA PREPARATION COMPLETE")
    print(f"Final rows: {len(prepared):,}")
    print("\nTarget distribution:")
    print(prepared["diabetes_diagnosis"].value_counts().sort_index())
    print(f"\nPrepared CSV: {OUTPUT_FILE}")
    print(f"Audit report: {AUDIT_FILE}")
    print("\nReview these outputs before training the model.")


if __name__ == "__main__":
    main()
