# Faith Clinic Diabetes Research Service

React/Vite frontend with a separate Flask API. This research and educational service classifies **self-reported previous diabetes diagnosis** using the approved NHANES 2017–2018 methodology. It is not designed or clinically validated to diagnose current diabetes or predict future onset.

## Current truthful status

- The public home page and “Learn and Live Well” education centre are informational only. The centre provides general diabetes, healthy eating, lifestyle, and FAQ content with links to WHO, IDF, NIDDK, and CDC sources. The project is not a clinical management platform: it does not provide ongoing glucose monitoring, clinician messaging, appointments, or emergency monitoring. Do not enter real patient health information.
- Patient/staff roles, clinician assignments, clinical record storage, and multilingual support are not implemented. Existing Supabase authentication and prediction-history functionality must not be treated as authorization for clinical records.
- Education copy links to reputable public-health information from the World Health Organization, International Diabetes Federation, NIDDK, and CDC. It is general information, not individualized clinical guidance.
- Flask health, model-information, exploration, prediction, and explanation routes are implemented.
- The prepared NHANES dataset and the matching Random Forest model/evaluation artifacts are present in `backend/data/processed` and `backend/model_artifacts`. The API validates the model bundle against its evaluation metadata before serving results.
- The model objective is to classify self-reported previous diabetes diagnosis. It does not predict future diabetes or diagnose a person.
- Model class probabilities are not shown to users because the model has not been clinically calibrated.
- SHAP explanations use the fitted model pipeline and are available only when the optional SHAP dependency is installed.
- The results page prefers the official Nigeria Health Facility Registry API when its approved API key is configured on the backend. Without a key or when the registry is unavailable, it can fall back to OpenStreetMap community listings, which are clearly labelled as unverified.
- Supabase Auth and row-level-secured history code and migration are implemented. They are not connected until the user configures a Supabase project, applies the migration, and provides local frontend credentials.
- Assessment fields are held in memory while submitting. They are not written to localStorage/sessionStorage. History saving is optional and stores only the predicted class, model version, user id, and database timestamp; uncalibrated model probabilities are neither saved nor displayed.

## Frontend

In PowerShell, move into this project folder, then start Vite:

```powershell
Set-Location 'C:\Users\HP\Desktop\diabetes-risk-prediction\diabetes-risk-prediction'
npm.cmd install
npm.cmd run dev
```

The app uses `http://127.0.0.1:5000` as its default API URL. For a different local API URL, set `VITE_API_BASE_URL`. Flask permits local Vite origins on ports 5173 and 5174 for both `localhost` and `127.0.0.1`.

The local `.env.local` file is prefilled with this project's Supabase URL. To enable Supabase Auth/history, set:

- `VITE_SUPABASE_URL`: `https://yseunbqagzajzgtctibk.supabase.co`.
- `VITE_SUPABASE_ANON_KEY`: the project's public **publishable** key (starts with `sb_publishable_`) from Supabase Dashboard → Project Settings → API Keys. The legacy `anon` public key also works.

Paste the public key after `VITE_SUPABASE_ANON_KEY=` in `.env.local`, then restart Vite. `.env.local` is ignored by git. **Never use a secret key, service-role key, or any secret in a `VITE_*` setting or browser code.** Supabase Auth persists its authentication session; assessment fields are not persisted by the app.

## Flask backend

Open a second PowerShell terminal:

```powershell
Set-Location 'C:\Users\HP\Desktop\diabetes-risk-prediction\diabetes-risk-prediction\backend'
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
.\.venv\Scripts\python.exe run.py
```

If `backend\.venv` does not exist, create it once with `py -3 -m venv .venv`. `backend/.env` is loaded using a path relative to the backend code, and relative artifact directories are resolved from `backend` rather than the shell's working directory. Do not expose the development Flask server to the public internet.

If `/api/explain/status` says SHAP is not installed, install the existing machine-learning requirements from the backend folder:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-ml.txt
```

Useful routes:

- `GET /api/health`
- `GET /api/model/info`
- `GET /api/model/exploration`
- `GET /api/explain/status`
- `POST /api/predict`
- `POST /api/explain`

The model registry validates matching model and evaluation artifacts before prediction or explanation. If either artifact is missing or invalid, the API returns an unavailable status and does not invent metrics or results.

## Facility search and privacy

The official registry API supports proximity searches and reports registration status. It requires an approved API key, available from the [registry developer portal](https://hfr.fmohconnect.gov.ng/developers); the registry says approval is typically within 24 hours. Put the key in `backend/.env` as `HFR_API_KEY=...`. The Flask backend sends it only in the server-to-server `X-API-Key` header. Do not put this key in a `VITE_*` setting or expose it in browser code.

Until that key is configured, the finder can use the public Photon geocoder and OpenStreetMap Overpass service. A manually entered place is sent to Photon; when a user chooses current location, approximate coordinates are sent through the backend to the registry and, if unavailable, to Overpass. The website does not save location values. Community map listings are not registration verification, and their straight-line distances are approximate. Public services may be unavailable or have usage limits. Registration can be checked directly with the [Nigeria Health Facility Registry](https://hfr.fmohconnect.gov.ng/).

The model is for academic research and education only. It does not establish a medical diagnosis or provide treatment advice. A qualified healthcare professional should provide appropriate testing, assessment, and treatment.

## Supabase setup

1. Create/configure a Supabase project and enable the desired email/password Auth settings.
2. Apply [`supabase/migrations/20261028000100_prediction_history.sql`](./supabase/migrations/20261028000100_prediction_history.sql) using the Supabase SQL editor or your approved migration workflow.
3. Configure the project URL and **public** publishable/anon key in local `.env.local`; restart Vite.
4. Create an account and test that history is empty. Insert and select operations are constrained by row-level security (`auth.uid() = user_id`). The browser never receives a service-role key.

The history table intentionally does not store raw assessment values, SHAP contributions, or uncalibrated model probabilities. The optional saved summary contains only the classification, model version, and database-generated timestamp.

## Dataset and preparation

The project uses the public **US NHANES 2017–2018** cycle, not a Nigerian population sample. Consult the [CDC NHANES 2017–2018 data files and documentation](https://wwwn.cdc.gov/nchs/nhanes/continuousnhanes/default.aspx?BeginYear=2017) for source-file and variable documentation. The preparation script joins the demographic, diabetes questionnaire, body-measurement, glycohemoglobin, fasting-glucose, smoking, blood-pressure, and medical-condition files by participant ID.

The target is **self-reported previous diabetes diagnosis** (`DIQ010`): documented yes is encoded as `1`, documented no as `0`, and unknown, refused, borderline, or other responses are excluded rather than mapped to no. The prepared complete-case CSV contains adults aged 20 or older and has exactly these columns:

`SEQN, age, sex, bmi, hypertension, heart_disease, fasting_glucose, hba1c, smoking_history, diabetes_diagnosis`

`SEQN` is used only to validate participant uniqueness and is never a model feature. Missing model inputs are not imputed; incomplete records are excluded and counted in `backend/data/processed/preparation_audit.json`. The resulting 2,288 complete cases contain 1,890 “No” and 398 “Yes” target records. Complete-case selection, the fasting-glucose subsample, self-report, and the US survey population limit generalizability. Results must not be presented as Nigerian-population estimates.

## Targeted feature-exclusion comparison

This is a **targeted feature-exclusion (ablation) experiment**, not an automated search for the best feature subset:

- **Model A — baseline:** age, sex, BMI, hypertension, heart disease, fasting glucose, HbA1c, and smoking history.
- **Model B — reduced:** the same six features except fasting glucose and HbA1c.

Both use the same complete-case cohort, one shared stratified 80/20 train/test split (random state 42), Random Forest settings (500 trees, random state 42), and the same five stratified cross-validation folds within the training portion. Preprocessing is fit separately on each training fold and on the training partition; the holdout is not used to fit preprocessing or select features. No hyperparameter search is conducted. All reported metrics are unweighted. Precision, recall, and F1 use “Yes, self-reported previous diabetes diagnosis” as the positive class.

### Measured held-out results

The comparison used 2,288 complete cases: 1,830 training records and a shared 458-record holdout (378 “No”, 80 “Yes”). The confusion matrices below use actual rows and predicted columns, ordered as documented “No” then “Yes”.

| Model | Features | Accuracy | Precision | Recall | F1-score | ROC-AUC | Confusion matrix |
|---|---:|---:|---:|---:|---:|---:|---|
| A — baseline | 8 | 0.9367 | 0.8400 | 0.7875 | 0.8129 | 0.9657 | `[[366, 12], [17, 63]]` |
| B — reduced | 6 | 0.8188 | 0.4762 | 0.3750 | 0.4196 | 0.7820 | `[[345, 33], [50, 30]]` |

### Training-only cross-validation

Values are mean ± standard deviation across the same five folds within the training partition.

| Model | Accuracy | Precision | Recall | F1-score | ROC-AUC |
|---|---:|---:|---:|---:|---:|
| A — baseline | 0.9137 ± 0.0125 | 0.8080 ± 0.0664 | 0.6668 ± 0.0610 | 0.7281 ± 0.0403 | 0.9443 ± 0.0154 |
| B — reduced | 0.7951 ± 0.0153 | 0.3492 ± 0.0656 | 0.2046 ± 0.0428 | 0.2569 ± 0.0491 | 0.7224 ± 0.0275 |

In this experiment, the reduced model had lower held-out and cross-validation metrics, including recall for the “Yes” class. The single holdout split is subject to sampling variability; no confidence intervals or hypothesis tests were estimated. This comparison does not show that glucose or HbA1c cause diabetes, nor does it demonstrate future-onset prediction or clinical performance. Because the shared dataset is complete-case on **all eight** inputs, Model B was still evaluated only among people with glucose and HbA1c data available; it does not establish performance in a broader population without laboratory measurements. Glucose and HbA1c may be related to prior diagnosis or its ascertainment, so their contribution is a research limitation that merits discussion.

The complete machine-readable results, including class counts, classification reports, confusion matrices, cross-validation results, software versions, and limitations, are in [feature_comparison.json](./backend/research_results/feature_comparison.json). Individual SHAP explanations for the currently served eight-feature model remain separate: SHAP describes contributions to a model output and is **not** a feature-selection method. The comparison does not replace the serving model or change the API input schema.

To reproduce the comparison using the existing prepared CSV and Python environment, run from the backend folder. Use a new output name because the script refuses to overwrite an existing report:

```powershell
Set-Location 'C:\Users\HP\Desktop\diabetes-risk-prediction\diabetes-risk-prediction\backend'
.\.venv\Scripts\python.exe train_model.py --input 'data\processed\nhanes_diabetes_complete_case.csv' --compare-feature-sets --comparison-output 'research_results\feature_comparison_reproduction.json'
```

No new dataset was downloaded. Do not load model artifacts from untrusted sources. The API continues to load the existing matching `model_bundle.joblib` and `evaluation.json`; these comparison results are not serving artifacts.

## Checks

```powershell
npm.cmd run build
npm.cmd run lint
Set-Location .\backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v
```
