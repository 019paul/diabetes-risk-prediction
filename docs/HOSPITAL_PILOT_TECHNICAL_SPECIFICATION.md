# Faith Clinic Hospital-Pilot Technical Specification

**Status:** Planning proposal only — not clinically approved, security-approved, or authorized for patient data  
**Prepared:** 30 October 2026  
**Project identity:** *Development of a Diabetes Risk Prediction and Feature Selection in a Web Application Using Random Forest and SHAP Analysis* — HND II academic project  
**Scope:** Define a future hospital-pilot architecture and implementation sequence while preserving the existing research application.

> This document is not a clinical protocol, legal opinion, regulatory determination, or authorization to process patient data. No clinical thresholds or diagnosis rules are specified here. The hospital must approve intended use, clinical protocol, data architecture, security controls, and regulatory pathway before implementation of clinical workflows.

## 1. Executive summary

The current Faith Clinic project is a React/Vite research and education frontend backed by a Flask research API. It contains a trained Random Forest model and matching evaluation metadata for classifying **self-reported previous diabetes diagnosis** in US NHANES 2017–2018 complete-case data. The API also supports individual SHAP explanations. This is not a clinical diagnosis, a prediction of future diabetes, or evidence of performance in Nigerian patients.

The future hospital system should add a separately governed, authenticated clinical workspace for patient identity, encounters, screening, laboratory observations, and clinician review. Clinical data and clinician-entered diagnoses must be separate from research-model outputs. The research model must remain an explicitly labelled, separately permissioned research function unless the hospital, ethics reviewers, and regulators approve an appropriate intended use.

The project is **not ready for clinical use or real patient records**. No patient registry, clinical laboratory pathway, clinician diagnosis workflow, clinical audit trail, production identity integration, or hospital deployment controls currently exist. Optional Supabase login and row-level-secured research prediction history do not provide authorization for clinical records and do not protect the Flask model endpoints.

## 2. Existing application inspection

### 2.1 Architecture and current features

| Area | Current implementation |
|---|---|
| Frontend | React 19, Vite, React Router. The primary page and route composition is in [`src/App.jsx`](../src/App.jsx), with styles in [`src/App.css`](../src/App.css) and [`src/index.css`](../src/index.css). |
| Public and research pages | Home, education, research/about, methodology, assessment, results, model explainability, validation, services, contact, and not-found pages. Faith Clinic branding and the HND II academic project identity are present. |
| Research assessment | The frontend submits eight predefined study inputs to the Flask API. The form does not represent a hospital patient/encounter workflow. |
| API client | [`src/lib/api.js`](../src/lib/api.js) calls health, model information, exploration, prediction, SHAP status, and explanation endpoints. |
| Backend | Flask application factory and routes are concentrated in [`backend/app/__init__.py`](../backend/app/__init__.py). Request field validation is in [`backend/app/validation.py`](../backend/app/validation.py). |
| Model loading and interpretation | [`backend/app/model_registry.py`](../backend/app/model_registry.py) loads and checks model/evaluation artifacts and computes SHAP explanations. The model input schema has eight ordered feature names. |
| Model/data research | [`backend/prepare_nhanes.py`](../backend/prepare_nhanes.py) prepares US NHANES 2017–2018 data; [`backend/train_model.py`](../backend/train_model.py) trains and evaluates the research model. Existing research output is retained under `backend/research_results/`. |
| Authentication | [`src/lib/auth.jsx`](../src/lib/auth.jsx) uses optional Supabase Auth email/password sessions. The current public sign-up flow is not a hospital-managed staff provisioning process. |
| Stored history | [`src/lib/history.js`](../src/lib/history.js) and [`supabase/migrations/20261028000100_prediction_history.sql`](../supabase/migrations/20261028000100_prediction_history.sql) provide optional user-owned minimal prediction history with row-level security. This is not a patient-record database. |
| Backend security boundary | Flask currently has a configured-origin CORS allowlist, request-size limit, input validation, and safe model-unavailable responses. CORS is not authentication. Clinical RBAC and staff authorization are not implemented on the Flask routes. |
| Testing | Frontend tests are run with `npm.cmd test`; backend tests with the unittest suite. Existing tests include temporary missing-artifact scenarios and synthetic model/API checks. They do not prove hospital security or clinical validity. |
| Deployment | `backend/run.py` starts Flask's development server bound to localhost by default. It is not a production hosting setup. No hospital-approved hosting, monitoring, recovery plan, or deployment pipeline is established. |

### 2.2 Research model boundary

The model's target is the participant's self-reported prior diabetes diagnosis, not laboratory-confirmed current disease and not future onset. The fitted preprocessing pipeline and feature order must remain tied to the artifact version. The model and its measured NHANES evaluation results are research assets and must not be silently relabelled, retrained, or overwritten during clinical-system development.

SHAP values explain contributions to a model output under the explanation method and model version used. They do not establish clinical causation, medical risk, diagnosis, or treatment.

## 3. Proposed system architecture

```text
Hospital-managed user accounts
       |
       | OIDC/SAML (hospital-selected); MFA and session policy per hospital
       v
React/Vite
  +-- Public Faith Clinic academic/research pages (existing)
  +-- Authenticated clinical workspace (new, separately routed)
       |
       | HTTPS; authenticated requests; server-enforced authorization
       v
Hospital-approved API gateway / reverse proxy
       |
       v
Flask application, modularized by bounded domain
  +-- Identity/session verification and authorization policy
  +-- Patient identity and encounter services
  +-- Screening and assessment services
  +-- Laboratory observation and protocol interpretation services
  +-- Clinician review and diagnosis-recording services
  +-- Append-only audit-event service
  +-- Separate research prediction/SHAP service
       |
       +-- Hospital-approved relational data store
       +-- Optional hospital EHR/laboratory/identity integrations
       +-- Existing research model artifacts (read-only, versioned)
       +-- Encrypted, monitored backup and recovery environment
```

### 3.1 Separation and trust boundaries

1. Keep public academic pages and the authenticated clinical workspace as distinct route groups and interaction flows.
2. Keep the research model output in a `research_model_run` record with target, model version, input provenance, and explicit non-diagnostic designation. Do not write it into a diagnosis field or treat it as laboratory interpretation.
3. Store measured laboratory values as observations, and store any protocol-derived interpretation separately with the applicable protocol version, author/service, and timestamp.
4. Record a confirmed diagnosis only through an authorized clinician workflow after the hospital approves the evidence and documentation requirements.
5. Enforce authentication, role, facility/team/encounter scope, and object-level permissions in the backend for every clinical API operation. Frontend route guards improve usability but are not a security control.
6. Keep administrative account duties separate from clinical access. A system administrator must not acquire clinical-record access solely by virtue of the administrator role.
7. Prefer integration with the hospital's identity and EHR/LIS systems if the hospital requires them. Define an interoperability profile and data ownership before building connectors.

### 3.2 Proposed API boundaries

These are logical resource groups, not a frozen contract. Final resource names, versioning, and integration formats require hospital architecture approval.

| Resource group | Illustrative operations | Authorization boundary |
|---|---|---|
| `/api/v1/identity` | Current staff identity, permitted facilities, session status | Authenticated staff; identity claims verified server-side |
| `/api/v1/patients` | Search, register, read, amend demographics/identifiers | Minimum necessary fields; facility/team scope; audited |
| `/api/v1/encounters` | Create, assign, read, close/reopen where approved | Assigned clinician/staff scope; audited |
| `/api/v1/assessments` | Create assessment, save responses, submit, read status | Approved instrument/version; encounter scope; author and timestamps |
| `/api/v1/lab-observations` | Record, correct/amend, read observation | Approved staff/lab roles; immutable correction history; provenance required |
| `/api/v1/clinical-reviews` | Create review, record interpretation/follow-up, amend | Authorized clinician; encounter scope; auditable signature/attribution |
| `/api/v1/diagnoses` | Record or amend clinician-documented diagnosis, if approved | Explicit diagnosis permission and protocol; never model-triggered |
| `/api/v1/research-model-runs` | Request/read research classification and matched SHAP output | Separately approved permission and purpose; no diagnosis write |
| `/api/v1/audit-events` | Restricted audit review/export | Designated auditor/privacy role; access itself audited |

Clinical endpoints should use explicit API versioning, request/response schemas, pagination for lists, concurrency/version checks for updates, idempotency where retries could duplicate writes, and consistent machine-readable errors that do not disclose protected information.

## 4. Proposed clinical workflows

### 4.1 Staff login and access

1. Staff accounts are provisioned through a hospital-approved identity source; there is no public clinician/admin self-registration.
2. The browser redirects to or uses the hospital-selected identity provider. A successful login yields a verifiable, short-lived identity credential according to hospital session policy.
3. The backend verifies issuer, signature, audience, expiry, and required claims; maps the immutable identity subject to an active staff profile and role/scope assignments.
4. Each protected request is authorized for the exact resource and action. The service checks staff status, assigned role, facility/team/encounter scope, and any required relationship to the patient.
5. Account disablement, role change, credential revocation, session expiry, and lost-device response follow hospital policy.
6. If emergency access is required, the hospital must specify the approved break-glass action, reason capture, time limit, alerting, and retrospective review. Do not add a generic bypass.

### 4.2 Patient registration and record management

1. Search the approved patient master index/EHR first using hospital-selected identifiers and matching rules.
2. If no match exists and staff are authorized to register, collect only the hospital-approved minimum data and create or request a patient identity through the system of record.
3. Present possible duplicates for authorized resolution; do not silently merge records based on a weak match.
4. Create an encounter linked to the resolved patient, site, encounter type, author, and source.
5. Maintain provenance and correction history for changes to identifiers or demographics. Restrict merge/unmerge to an explicitly authorized role with audit review.
6. Enforce lifecycle rules for retention, archival, corrections, export, and deletion based on the hospital-approved policy and legal obligations.

Patient identifiers must not be placed in browser storage, URLs, telemetry, generic application logs, or analytics. The system should display only identifiers needed for the user's task.

### 4.3 Diabetes screening and assessment

1. Authorized staff select or open a patient encounter.
2. The application presents the hospital-approved screening instrument and version, with purpose, required fields, validation, and supported language/accessibility needs.
3. The user records responses with author, timestamps, encounter, and instrument version. Save/resume behavior and incomplete status must be explicit.
4. On submission, the server validates the schema and authorization, persists the assessment and provenance, and returns a screening state defined by the approved protocol.
5. The patient-facing explanation must distinguish screening from laboratory assessment and confirmed diagnosis, and communicate the approved next step.
6. No research-model result or unapproved rule may replace, silently alter, or automatically convert the approved screening result.

### 4.4 Laboratory result recording and interpretation

1. Authorized staff select the encounter and record or receive the observation from a verified laboratory source.
2. Required provenance must be agreed with the hospital laboratory. Candidate fields include test code/name, numeric or qualitative value, unit, specimen, collection/result timestamps, laboratory/source, method where relevant, and applicable conditions.
3. Validate units, value shape, source, and timestamps against the approved catalog. Preserve the observed value; do not silently transform or overwrite it.
4. Amendments create a traceable correction/version with author, time, reason, and prior value. Corrections must not erase the original record.
5. If the hospital approves protocol-driven interpretation, store it separately from the observation with protocol identifier/version, rule/result state, execution timestamp, and review requirement.
6. If evidence is incomplete, conflicts, falls outside approved rule coverage, or the protocol calls for review/confirmation, route to an authorized clinician and communicate only the hospital-approved wording.
7. No diagnostic threshold, confirmation rule, or laboratory quality assumption should be coded until signed off by the clinical owner and laboratory lead.

### 4.5 Clinician review and diagnosis documentation

1. Screening or laboratory workflow may create a review task according to the approved protocol; it does not create a diagnosis.
2. A clinician with explicit permission opens the encounter and reviews source observations, assessment, prior relevant history, protocol version, and any separately displayed research-model information.
3. The clinician records interpretation, decision, evidence considered, follow-up, and any diagnosis they are authorized to document.
4. The system records reviewer identity, role at time of action, timestamp, encounter, protocol/version, and amendments. The audit event and clinical record update should be transactionally linked or recoverably reconciled.
5. A diagnosis is never generated solely from a Random Forest class, probability, or SHAP contribution. Any structured diagnosis terminology and coding system must be approved by the hospital.
6. Corrections and disagreements use an approved amendment or addendum process. No silent overwrite of signed review.

## 5. Roles and permission model

Roles should be granted by hospital identity administrators and combined with attributes such as facility, department, care team, assigned encounter, and purpose of use. This matrix is a proposal for discussion, not an authorization policy. Every `Yes` remains scoped by the hospital's rules.

| Capability | Doctor / authorized clinician | Healthcare staff | Administrator | Auditor / privacy reviewer |
|---|---:|---:|---:|---:|
| Search/identify a patient | Yes, permitted scope | Yes, minimum necessary scope | No by default | No by default |
| Register/update approved demographics | If authorized | Yes, assigned scope | No clinical access by default | No by default |
| Create/read encounters | Yes, permitted scope | Yes, assigned workflow | No clinical access by default | No by default |
| Record screening responses | Yes | Yes, assigned workflow | No | No |
| Record laboratory observations | If authorized | Only when credentialed/assigned | No | No |
| View protocol interpretation | Yes | Limited to task needs | No | No |
| Record clinician review/follow-up | Yes, within credentials | No, unless separately authorized | No | No |
| Confirm/document a diagnosis | Yes, explicit permission and approved workflow | No by default | No | No |
| Amend a signed review/diagnosis | Authorized clinician under amendment policy | No | No | Read/review audit only |
| Run/view research model/SHAP | Only if separately approved and needed | Only if separately approved and needed | No by default | Read-only only if authorized |
| Manage staff accounts/role assignments | No, unless separately assigned | No | Yes, identity administration only | Review role-change audit |
| Configure approved protocol versions | Clinical governance-authorized operator; dual approval recommended | No | Technical deployment only; cannot author clinical meaning | Review change history |
| Read protected audit events | Own actions as policy permits | Own actions as policy permits | Operational logs, not clinical audit by default | Yes, defined audit scope |
| Export patient data | Explicitly authorized purpose and scope | No by default | No by default | Only under approved audit/privacy request |

**Permission implementation:** deny by default; authorize each action and resource on the backend; scope queries before fetching records; avoid trusting client-provided role or patient identifiers; test direct-object-reference and cross-facility access; audit denied sensitive actions where policy requires.

## 6. Database recommendation and proposed entities

### 6.1 Recommendation

For a new structured clinical record system, a relational database such as PostgreSQL is a strong candidate because patient/encounter relationships, transactional updates, constraints, and audit references are central requirements. This is a recommendation for evaluation—not a selection. The hospital must decide whether to extend an existing EHR/database, use a hospital-hosted managed relational service, or approve another architecture based on ownership, hosting, identity, interoperability, support, data location, and vendor review.

Do not treat the current Supabase prediction-history table as a clinical schema. Do not connect any database until the hospital approves the architecture, data-processing responsibilities, access model, retention, migrations, backup plan, and threat model.

### 6.2 Candidate entities

| Entity | Purpose and key relationships |
|---|---|
| `organization` / `facility` / `department` | Hospital and care-site boundaries; ownership and scope for users and encounters. |
| `staff_profile` | Link a hospital identity-provider subject to staff status and approved non-secret profile attributes. Do not store passwords if hospital SSO is used. |
| `role_assignment` | Role, facility/team scope, effective dates, grantor, and revocation history. A user can have multiple scoped assignments. |
| `patient` | Internal patient record identity, lifecycle state, and minimal demographics approved by the hospital. |
| `patient_identifier` | One or more source-qualified identifiers with issuer, validity, and provenance; enforce hospital-approved uniqueness and matching rules. |
| `patient_link` / `merge_event` | Traceable identity reconciliation across approved systems; retain merge/unmerge history rather than destructive merging. |
| `encounter` | Patient, facility, type, status, assigned care team, start/end timestamps, source, and author. |
| `assessment_definition` / `assessment_version` | Approved screening instrument, question/schema version, language, effective period, and approver. |
| `assessment` / `assessment_response` | Encounter-specific answers, completion state, author, timestamps, and version; minimize storage and restrict access. |
| `lab_test_catalog` | Hospital-approved test identifiers, accepted units/specimens/method metadata, and effective dates. |
| `lab_observation` | Observed value/qualifier, unit, specimen, collection/result times, source lab/system, provenance, status, and amendment lineage. |
| `clinical_protocol` / `protocol_version` | Approved source/version, scope, effective period, author/approvers, rule package reference, and change history. |
| `clinical_interpretation` | Protocol-derived state or clinician-entered interpretation, with source evidence, protocol/version, author/service, timestamp, and review status. Keep separate from observations and diagnoses. |
| `clinical_review` | Clinician, encounter, review outcome, rationale/evidence references, follow-up, signature state, and amendment linkage. |
| `diagnosis_record` | Clinician-documented diagnosis only when approved; terminology/code system, status, effective date, author, evidence references, and amendment history. Not populated by the model. |
| `follow_up_task` | Approved action, owner, due/status, encounter linkage, and completion evidence. |
| `research_model_run` | Research-only target, model/artifact version, request purpose, permitted input reference or approved minimization strategy, output class, timestamp, and retention. Avoid unnecessary copies of raw identifiers/features. |
| `research_explanation` | SHAP values, scale, class, model version, generation timestamp, and interpretation disclaimer; access and retention governed separately. |
| `audit_event` | Actor, action, resource type/id, timestamp, outcome, scope, correlation ID, and reason where required. Append-only or tamper-evident under hospital controls. Avoid duplicating PHI in event payloads. |
| `integration_message` / `delivery_record` | Optional EHR/LIS interface delivery, idempotency key, source, acknowledgment, retry state, and error metadata without exposing PHI in routine logs. |
| `consent_or_notice_record` | Only if the approved legal and clinical model requires recording notice/consent state; do not assume consent is the sole lawful basis. |

The final logical and physical schemas, identifiers, terminology, retention rules, and encryption boundaries require hospital sign-off. Avoid storing large opaque JSON blobs as the sole source of truth for clinical observations or signed reviews.

## 7. Research Random Forest and SHAP isolation

1. Preserve the existing bundle, evaluation metadata, NHANES preparation outputs, and feature comparison results without overwrite.
2. Keep current model objective labels exactly tied to self-reported previous diagnosis. Do not rename the outcome “diabetes diagnosis,” “future risk,” or a Nigerian clinical risk estimate.
3. Put research inference behind authenticated backend authorization before any approved pilot use. Keep the public/research demonstration non-patient-facing or synthetic until approval.
4. Use a separate model-run type/namespace and UI panel. Never use model output as the value, default, rule input, or trigger for `diagnosis_record`.
5. Display model version, study target, population/context, limitations, and non-diagnostic wording alongside output. Avoid making probability appear calibrated unless independently established and approved.
6. Generate SHAP only for an authorized, matched request and model version. Label it “model-output explanation”; state that it is not medical causation or clinical importance.
7. The hospital/research ethics review must decide if model input/output is permitted in the pilot, whether it can be linked to patient records, whether results may be shown to clinicians or patients, and how long outputs are retained.
8. A future clinical model would require a separately defined intended use, suitable representative dataset and reference standard, prospective/independent validation, calibration, subgroup analysis, clinical safety review, and regulatory determination. That work is outside this pilot specification.

## 8. Security, privacy, regulatory, and operational requirements

### 8.1 Security controls to design and verify

- Hospital-managed identity; secure session/token validation; MFA/session policies as approved; account provisioning and prompt deprovisioning.
- Backend-enforced role- and attribute-based access, least privilege, resource-level checks, and facility/encounter scoping.
- TLS in transit; encryption at rest and backups; managed key custody/rotation; secrets outside source control and browser bundles.
- Database service accounts with least privilege; network segmentation; restricted administration; no public database access.
- Request/schema validation, safe output encoding, CSRF protections if cookie-based sessions are used, rate limits, secure headers, CORS allowlisting, and abuse/error monitoring.
- Audit events for sensitive access and changes according to hospital policy; protect audit integrity; restrict audit search/export; do not log secrets or unnecessary PHI.
- Secure dependency and vulnerability management, code review, threat modeling, penetration/security testing by authorized parties, incident response, and patch/release control.
- Privacy by design: minimum necessary data, purpose limitation, approved retention/deletion, export governance, patient-rights handling, and privacy review of telemetry/vendors.
- No real patient information in development, browser storage, screenshots, issue trackers, general logs, analytics, or unapproved test environments.

### 8.2 Privacy and regulation

Before any real patient data is processed, hospital privacy counsel/data-protection personnel must assess the Nigeria Data Protection Act 2023 and applicable NDPC rules/directives, including controller/processor roles, lawful basis, notices and rights, purpose, minimization, retention, vendor processing, cross-border transfers, breach obligations, and whether a privacy-impact assessment or other regulatory engagement is required.

The hospital and qualified regulatory counsel must determine whether the intended functionality and claims are subject to applicable medical-device/software-as-a-medical-device requirements, including any NAFDAC registration or review. This determination depends on intended use and claims; the development team must not claim compliance or approval.

If identifiable data is used for research or model validation, the hospital must determine the ethics committee/IRB pathway, approvals, consent/waiver basis, and data-access permissions before the data is obtained or used.

### 8.3 Production hosting, backups, and recovery

- Hospital selects hosting/vendor, data location, network architecture, DNS/domain, TLS termination, secrets manager, database service, and deployment ownership.
- Do not use Flask's development server in production. Select a supported production WSGI/app-serving and reverse-proxy setup under hospital operations.
- Define environment separation (development, test, staging, production); production data must not be copied to lower environments without approved de-identification and authorization.
- Define availability/monitoring objectives, alert receivers, maintenance windows, release gates, rollback method, and operating support.
- Hospital defines RPO/RTO, backup frequency/retention, encryption, immutable/off-site requirements, restoration access, and disaster-recovery location.
- Verify recovery by scheduled restore exercises and document measured recovery time/data point. A backup job without restore evidence is not an accepted recovery plan.

## 9. Phased roadmap, dependencies, and acceptance criteria

| Phase | Dependencies | Deliverables | Acceptance criteria / exit gate |
|---|---|---|---|
| **0 — Hospital discovery and intended use** | Hospital sponsor and clinical owner identified | Intended-use statement, pilot boundary, stakeholder map, user groups, initial risk register | Named accountable owners approve scope and explicitly exclude unapproved automated diagnosis/treatment. |
| **1 — Clinical protocol and workflow** | Phase 0 | Signed source/version; screening, lab, confirmation, discordance, review, follow-up, escalation, and wording requirements | Clinical governance and laboratory lead approve protocol and synthetic acceptance scenarios; no threshold is encoded before approval. |
| **2 — Privacy, regulatory, and architecture decisions** | Phases 0–1 | Data-flow/retention diagrams, privacy assessment, threat model, hosting/identity/database/integration decisions, regulatory and ethics determinations | Hospital architecture, privacy, security, ethics (if applicable), and regulatory owners record approvals and conditions. |
| **3 — Identity and authorization foundation** | Approved identity provider, role matrix, environment/security design | Hospital identity integration, staff provisioning/deprovisioning, backend authorization and audit foundation | Automated tests prove unauthenticated, wrong-role, wrong-facility, wrong-encounter, disabled-user, and expired-credential access is denied. Role changes are auditable. |
| **4 — Data model and patient/encounter foundation** | Approved database, identifiers, retention, migration and backup plan | Versioned schema/migrations, patient lookup/registration, duplicate handling, encounter lifecycle | Synthetic-data integration tests verify patient identity, duplicate resolution, field minimization, scoped access, corrections, and audit events. Restore test succeeds before production-like use. |
| **5 — Screening and laboratory capture** | Approved protocol, assessment definitions, lab catalog/units/source systems | Versioned assessment, observation capture, provenance, validation, correction flow | Clinical/lab owners approve UI and edge-case tests; all observations preserve units/source/timestamps; interpretation remains disabled unless separately approved. |
| **6 — Protocol interpretation and clinician review** | Signed executable rules/specification, clinician roles/credentials, Phase 5 | Versioned rules service, clinician work queue, review, follow-up, diagnosis documentation and amendment | All approved protocol test vectors pass; unauthorized roles cannot confirm; every signed action identifies reviewer/time/version/evidence and is amendable only by approved process. |
| **7 — Research-model/SHAP integration decision** | Ethics/privacy approval and explicit hospital decision on model visibility/use | Isolated research namespace, authorization, labels, version provenance, SHAP matching, retention policy—or a decision to exclude model from pilot | Demonstrate no model/SHAP output can create or mutate a clinical interpretation or diagnosis; output is correctly versioned and access-logged. |
| **8 — Verification and pilot readiness** | Phases 0–7 and approved non-production environment | Security/privacy test results, accessibility/usability results, load/failure tests, backup/restore evidence, training/runbooks, pilot monitoring and stop criteria | No unresolved critical/high risks; clinical, security, privacy, operations, regulatory/ethics approvals documented; explicit go-live authorization. |
| **9 — Controlled pilot and evaluation** | Phase 8 approvals and trained users | Restricted pilot, monitoring, incident/near-miss reporting, usage and safety evaluation, rollback readiness | Predefined hospital success/safety criteria met; governance reviews outcomes and explicitly approves continuation, changes, or stop. |

Phases 1 and 2 can proceed in parallel only where their work products do not assume unapproved protocol or data decisions. Implementation of clinical data collection depends on approved identity, privacy, architecture, and data-governance decisions. Automated interpretation depends on a signed clinical protocol and tested rule specification. Patient data must not be used in any phase before explicit authorization.

## 10. Repository changes expected after approval

This section identifies likely future implementation surfaces only. **No application files were changed to produce this specification.**

### Existing surfaces to preserve and selectively evolve

- [`src/App.jsx`](../src/App.jsx): retain public/research routes and branding; introduce a separately routed authenticated workspace after workflow approval.
- [`src/App.css`](../src/App.css), [`src/index.css`](../src/index.css): add clinical-workspace styling/accessibility without removing academic identity.
- [`src/lib/api.js`](../src/lib/api.js): add a shared authenticated API client and typed clinical resource operations once identity/session handling is approved.
- [`src/lib/auth.jsx`](../src/lib/auth.jsx), [`src/lib/supabase.js`](../src/lib/supabase.js): retain or replace optional research auth only after the hospital chooses its identity provider; do not assume current Supabase configuration is approved for clinical data.
- [`backend/app/__init__.py`](../backend/app/__init__.py): refactor route registration into domain modules; add authentication/authorization integration without weakening existing validation/error handling.
- [`backend/app/validation.py`](../backend/app/validation.py): retain the existing study-model schema; define distinct, protocol-derived schemas for clinical resources rather than expanding model inputs to accept patient data.
- [`backend/app/model_registry.py`](../backend/app/model_registry.py): preserve artifact integrity checks and isolate research model run metadata from clinical diagnosis resources.
- [`supabase/migrations/20261028000100_prediction_history.sql`](../supabase/migrations/20261028000100_prediction_history.sql): preserve as research-history migration; never reinterpret it as the patient database.
- [`README.md`](../README.md): maintain academic/research and clinical-use boundaries; later document only hospital-approved setup and operating procedures.
- Existing model artifacts, datasets, academic acknowledgement, and research results remain untouched.

### Candidate new code areas after decisions

```text
src/
  clinical/
    patients/
    encounters/
    assessments/
    laboratory/
    clinician-review/
    audit/
  lib/
    clinical-api.js
    identity-session.js

backend/app/
  api/                 # versioned route registration
  auth/                # provider token verification and staff identity
  authorization/       # role/attribute policies and scope checks
  patients/
  encounters/
  assessments/
  laboratory/
  protocols/           # approved, versioned interpretation only
  clinical_reviews/
  audit/
  research/            # existing model/SHAP isolated behind policy
  persistence/         # repository/unit-of-work boundary

backend/migrations/    # only after the hospital selects migration/database tooling
backend/tests/
  authorization/
  patients/
  assessments/
  laboratory/
  clinical_reviews/
  audit/
```

These are proposed boundaries, not a decision to introduce a framework, package, database, or vendor. Select tooling only after the hospital architecture decision; maintain migrations, backups, and deployments under a reviewed change process.

## 11. Hospital decisions required before implementation

### Clinical and operational

- Who is the accountable clinical owner and who approves protocol changes?
- What intended use and patient population is in scope? Is the pilot research-only, screening support, or clinical decision support?
- Which locally adopted guideline, exact edition, test methods, quality assumptions, units, confirmation/discordance handling, and escalation language govern?
- Which staff may collect each data item, interpret results, sign reviews, document diagnoses, amend signed records, and assign follow-up?
- Which structured terminology/coding and language/accessibility requirements apply?
- Is the Random Forest/SHAP component excluded from the pilot, visible only to researchers, or visible to clinicians under an approved research protocol?

### Data and architecture

- What is the system of record for patient identity, encounters, laboratory results, and diagnoses?
- Is a standalone registry permitted, or must the app integrate with the hospital EHR/LIS? Which interface standard, version/profile, patient matching, and acknowledgment/retry behavior are required?
- Which identity provider and provisioning/deprovisioning process must be used? Is Supabase permitted at all, and for which data?
- Which database/hosting vendor, data location, network boundary, encryption/key-management service, and operational team are approved?
- What are the minimum necessary patient/staff fields, lawful processing basis, notices, correction rules, retention/deletion/export policy, and audit scope?
- What data are retained for model inputs, outputs, SHAP, technical logs, and incident investigation?

### Governance and readiness

- What privacy-impact/DPIA, NDPA/NDPC, ethics/IRB, hospital security, and medical-device/software regulatory determinations are required?
- Who is controller, processor, and subprocessor for each component? Which contracts and security reviews are required?
- What are RPO/RTO, uptime/support expectations, monitoring ownership, incident contacts, restore-test frequency, pilot size/sites, safety metrics, and stop conditions?
- Who signs the final acceptance and gives explicit authorization to go live?

## 12. Recommended implementation order

1. Obtain the hospital sponsor, clinical owner, laboratory lead, privacy/security owners, and IT/operations owner.
2. Agree intended use, pilot scope, prohibited uses, and whether research-model output is excluded.
3. Obtain the signed clinical protocol and testable workflow cases; do not encode thresholds before this gate.
4. Approve privacy/regulatory/ethics review, identity provider, data ownership, database/hosting, retention, integrations, and recovery objectives.
5. Finalize the role/attribute permission matrix, threat model, data-flow diagram, entity model, and API contract.
6. Build and verify identity, backend authorization, audit foundation, environment separation, and synthetic test harness first.
7. Implement patient/encounter foundation and only then screening and laboratory capture.
8. Add approved interpretation and clinician review/diagnosis documentation only after clinical rule approvals and tests.
9. Integrate the research model/SHAP only if the hospital and applicable ethics/privacy reviewers explicitly approve that use; keep it separate.
10. Complete security, privacy, accessibility, usability, load/failure, integration, and backup-restore verification before a restricted pilot.
11. Train users, launch only with written approvals, monitor against stop criteria, and seek explicit governance approval before expansion.

## 13. Acceptance principles

- No real patient data is used before explicit hospital authorization and approved controls.
- Every protected API operation enforces server-side identity, role, and resource scope.
- Patient, laboratory, interpretation, research output, and diagnosis records are distinct concepts with provenance.
- No automated diagnosis, threshold, treatment instruction, or escalation is activated without a hospital-approved protocol and acceptance tests.
- No model result or SHAP explanation can create, edit, or override a clinician diagnosis.
- Every sensitive create/read/update/export and privileged action is handled according to the approved audit policy.
- All development and QA examples are synthetic and clearly marked as test data.
- Research model assets, feature comparison results, Faith Clinic branding, and HND II acknowledgement are preserved.
- A technical build, passing health endpoint, trained model, or successful backup is not by itself evidence of clinical, regulatory, privacy, or production readiness.
