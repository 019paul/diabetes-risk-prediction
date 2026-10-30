# Faith Clinic Hospital Requirements and Approval Document

**Document status:** Draft for hospital discovery — no hospital answers or approvals have been recorded  
**Prepared:** 30 October 2026  
**Related specification:** [Hospital-Pilot Technical Specification](./HOSPITAL_PILOT_TECHNICAL_SPECIFICATION.md)  
**Project identity:** *Development of a Diabetes Risk Prediction and Feature Selection in a Web Application Using Random Forest and SHAP Analysis* — HND II academic project  
**Use:** Requirements-gathering and approval record for considering a future hospital pilot

> This document is not a clinical protocol, legal opinion, regulatory determination, security approval, or authorization to collect or process patient information. Do not enter patient data in response to this document. No diagnostic threshold or clinical rule is proposed. All hospital answers and approvals must be completed by authorized hospital representatives.

## 1. How to use this document

Each item is classified so established project facts are not confused with proposed design or hospital decisions:

- **CONFIRMED EXISTING INFORMATION** — verified description of the current Faith Clinic project; it is not hospital approval.
- **PROPOSED REQUIREMENT** — a design recommendation for hospital discussion; it is not an adopted policy.
- **QUESTION AWAITING HOSPITAL ANSWER** — information or a decision the hospital must provide.
- **FORMAL APPROVAL REQUIRED** — a documented approval gate before the relevant implementation or use.

For each question, record the hospital's answer in the decision register or an attached approved record, including the responsible person, date, evidence/reference, and approving authority. “Not applicable” requires a rationale and approval where the matter is within that authority's remit. Blank or unapproved items remain open.

## 2. Project overview and objectives

### Confirmed existing information

- Faith Clinic is currently a React/Vite frontend with a Flask backend.
- The academic research project uses a Random Forest and SHAP analysis.
- The research target is **self-reported previous diabetes diagnosis** in US NHANES 2017–2018 complete-case data. It is not a confirmed current diagnosis or future-onset target.
- The repository contains matching model and evaluation artifacts and supports research prediction and individual SHAP explanation.
- Existing Faith Clinic branding and HND II academic acknowledgement are to be preserved.
- The current application is not a hospital clinical-record system and is not authorized for real patient data.

### Proposed requirements

- Define the intended hospital use, population, care setting, users, locations, and limits before designing clinical workflows.
- Keep the public academic/research experience separate from any future authenticated clinical workspace.
- Make screening, laboratory observations, clinician interpretations, diagnoses, and research model outputs distinct concepts and records.
- Limit the first pilot to an explicitly approved scope with named clinical, privacy, security, technical, and operational owners.

### Questions awaiting hospital answers

1. What clinical or operational problem is the proposed pilot intended to address?
2. Is the intended use research, education, screening support, clinical decision support, or another use?
3. Which patient population, age group, departments, facilities, and care settings are in scope?
4. Who will use the system, and who will be accountable for its clinical use?
5. What uses are explicitly out of scope (for example, diagnosis, treatment selection, emergency care, or autonomous triage)?
6. Is the existing research model to be excluded from a clinical pilot, available only to approved researchers, or shown to clinicians under an approved research purpose?

### Formal approvals required

- Written intended-use and scope approval from the hospital sponsor and accountable clinical governance authority.
- Written determination of whether ethics review, research approval, or other governance review is required for the proposed pilot.
- Written authorization before real patient information is accessed, entered, imported, or processed.

## 3. Questions for hospital management

### Confirmed existing information

- No hospital sponsor, pilot site, clinical owner, or operational owner is identified in the current repository.
- No hospital affiliation, certification, or approval is claimed by the project.

### Proposed requirements

- Appoint an executive sponsor and accountable clinical product owner.
- Establish a decision-making group with clinical, laboratory, nursing/healthcare staff, privacy, security, IT/architecture, operations, legal/regulatory, and research/ethics representation as applicable.
- Agree a pilot charter, scope, funding/support ownership, user training, success measures, safety monitoring, incident handling, and stop conditions before a pilot.
- Require a named owner and review date for every policy, protocol, data, and operational decision.

### Questions awaiting hospital answers

1. Which hospital or facility would sponsor and host the pilot?
2. Who is the executive sponsor and who is accountable for clinical safety?
3. Which departments and staff groups will participate?
4. What is the proposed pilot duration, capacity, and operational support model?
5. Who approves requirements, clinical changes, releases, incidents, and continuation or termination of the pilot?
6. What outcomes will management use to decide whether to proceed, revise, or stop?
7. Who will fund and own hosting, licensing, integrations, support, maintenance, and recovery?

### Formal approvals required

- Signed pilot charter and intended-use statement.
- Named approval authority for clinical, information governance, security, architecture, operations, research/ethics, and regulatory decisions.
- Written go/no-go decision before pilot deployment or patient-data processing.

## 4. Questions for doctors and clinical staff

### Confirmed existing information

- Current research outputs concern the model's research classification target and do not provide a clinical review workflow.
- The current application does not implement clinician assignments, signed clinical reviews, follow-up tasks, or clinician-confirmed diagnoses.

### Proposed requirements

- Clinicians and staff should co-design the workflow, patient-facing language, exceptions, review queue, follow-up ownership, and correction process.
- The system should clearly distinguish a screening result from laboratory evidence, clinician interpretation, and clinician-documented diagnosis.
- Clinical users should be able to identify source, date, author, protocol version, and status of information they review.
- The system should not recommend or prescribe treatment based solely on a model output.

### Questions awaiting hospital answers

1. Which clinicians and staff are authorized to collect screening information and record laboratory observations?
2. Which professional roles may interpret results, sign a review, document a diagnosis, amend a signed record, and assign follow-up?
3. Is a second review or other sign-off required for any action?
4. What clinical workflow applies when results are missing, discordant, delayed, corrected, or outside the approved protocol?
5. What patient communications and escalation instructions are approved, and who owns them?
6. What training and competency checks are required before access is granted?
7. How will clinicians report usability problems, near misses, or safety concerns?

### Formal approvals required

- Clinical governance approval of workflow diagrams, terminology, decision responsibilities, patient-facing wording, and exception handling.
- Credentialing/clinical administration approval of the role-to-action matrix.
- Approval of training materials and clinical safety monitoring before users participate.

## 5. Patient registration and patient-record requirements

### Confirmed existing information

- The current app does not have patient registration, a patient master index, encounter-linked clinical records, or a clinical-record lifecycle.
- Existing Supabase history is a minimal user-owned research prediction summary, not a patient chart.

### Proposed requirements

- Identify or register a patient only through a hospital-approved identity and record workflow.
- Search the hospital's designated system of record before creating a new identity, if the hospital requires this.
- Use hospital-approved identifiers, patient matching, duplicate review, merge/unmerge, correction, and provenance processes.
- Collect only fields justified by the approved intended use and data-minimization assessment.
- Link screening, laboratory observations, reviews, and follow-up to a patient and encounter, with author, timestamps, source, status, and correction lineage.
- Define retention, archival, deletion, access, export, and patient-rights handling before implementation.
- Do not put patient identifiers in browser storage, URLs, telemetry, generic logs, or analytics.

### Questions awaiting hospital answers

1. What system is the authoritative patient identity source?
2. Is standalone patient registration permitted, or must registration occur in an EHR or master patient index?
3. Which identifiers and minimum demographic fields may be used, by which roles, and for what purpose?
4. What patient matching and duplicate-resolution rules are approved? Who can merge or unmerge records?
5. What consent, notice, lawful-basis, guardian, or special-population requirements apply?
6. What are the retention, correction, archival, deletion, export, and access-request procedures?
7. Are patient records expected to be shared across facilities or linked to existing encounters?

### Formal approvals required

- Data owner and clinical owner approval of the patient/encounter field catalogue and lifecycle.
- Privacy/legal approval of lawful processing, notice/consent approach, retention, rights handling, and data sharing.
- Architecture and security approval of patient identity integration, matching, access scope, and record-storage boundaries.

## 6. Diabetes screening and assessment requirements

### Confirmed existing information

- The existing assessment is a research input form with eight model fields; it is not a hospital-approved screening instrument.
- Its current model schema includes age, sex, BMI, hypertension, heart disease, fasting glucose, HbA1c, and smoking history.
- That field list reflects the research model and must not be assumed to be a clinically approved minimum dataset or screening questionnaire.

### Proposed requirements

- Use only a screening instrument selected and approved by the hospital for the stated intended use and population.
- Version the instrument, questions, response options, translations, instructions, and effective dates.
- Record author, encounter, time, instrument version, completion state, and any approved source/provenance.
- Preserve incomplete and corrected assessments distinctly; define who may create, amend, submit, or review them.
- Keep screening output and next steps separate from diagnosis and model classifications.
- Test accessibility, language, usability, validation, and edge cases with synthetic scenarios before any pilot.

### Questions awaiting hospital answers

1. Which screening instrument or workflow is approved, and who owns its content?
2. Which patient groups and settings are eligible or excluded?
3. What questions, answer choices, requiredness, skip logic, language, and accessibility requirements apply?
4. How are incomplete, refused, unknown, or not-applicable responses recorded?
5. What screening states and patient/staff messages are approved?
6. Who reviews a submitted screening and determines its next step?
7. How are instrument changes approved, versioned, communicated, and evaluated?

### Formal approvals required

- Signed approval of the instrument, version, population, workflow, wording, and acceptance test cases by the designated clinical authority.
- Privacy approval of fields collected and their purpose.
- No screening logic is activated until the approved requirements are testable and signed.

## 7. Laboratory testing and reporting requirements

### Confirmed existing information

- The research model accepts fasting glucose and HbA1c values as model inputs.
- These values are research features; their presence does not make the current application a laboratory-result system or authorize diagnostic interpretation.
- The current app has no laboratory source integration, result provenance workflow, correction history, or approved clinical rules.

### Proposed requirements

- Treat a laboratory observation as a measured result with source and provenance; do not overwrite or conflate it with a derived interpretation.
- Record only hospital-approved test identifiers, values, units, specimen, relevant conditions, timestamps, source laboratory/system, method, and status.
- Validate the result against a hospital-approved test catalogue and unit conventions.
- Preserve corrections and amendments with original value, author, time, and reason according to hospital policy.
- If an interpretation service is approved, record it separately with protocol/version, execution context, result state, and review requirement.
- Route results outside approved rule coverage or requiring confirmation to a clinician using approved messages.

### Questions awaiting hospital answers

1. Which tests are in scope, and what are the hospital-approved test codes, names, units, specimen types, and methods?
2. Which laboratories and source systems may supply results? Is manual entry allowed, and for which roles?
3. Which timestamps and patient/encounter identifiers are authoritative?
4. What quality assurance, assay standardization, interference, fasting/collection-condition, and result-status information must be recorded?
5. How are corrected, cancelled, duplicate, delayed, or imported results handled?
6. Which protocol and exact version governs interpretation, confirmation, discordance, and referral?
7. How should the system behave when required context or provenance is missing?

### Formal approvals required

- Laboratory lead approval of test catalogue, source systems, units, methods, provenance, correction workflow, and interface requirements.
- Clinical governance approval of the applicable protocol, interpretation/confirmation behavior, wording, and test cases.
- Security, privacy, architecture, and interface-owner approval before connection to any laboratory system.
- No diagnostic thresholds or rules are to be entered in this document or implemented until approved in the hospital's controlled protocol specification.

## 8. Clinician review and diagnosis responsibilities

### Confirmed existing information

- The current system does not provide authorized clinician review, diagnosis recording, review signatures, or follow-up management.
- The research model cannot establish a confirmed diagnosis.

### Proposed requirements

- Make a clinician review an attributable action tied to an encounter and the evidence reviewed.
- Record reviewer identity and role, time, review state, interpretation, source evidence, protocol/version where applicable, follow-up, and any amendment.
- Permit diagnosis documentation only for a hospital-authorized clinician with explicit diagnosis permission and only under the approved workflow.
- Keep diagnosis records separate from screening results, laboratory observations, derived interpretations, and research model outputs.
- Use an approved amendment/addendum process; do not silently overwrite a signed review or diagnosis.
- Ensure technical administrators cannot confirm diagnoses solely because they administer accounts or infrastructure.

### Questions awaiting hospital answers

1. Which credentials and roles authorize a clinician to review and document a diagnosis?
2. What evidence and documentation must be present before a clinician records a diagnosis?
3. Is a second reviewer, co-signature, or other approval required?
4. What terminology/coding system and status lifecycle are used?
5. How are disagreements, amendments, corrections, and retrospective changes managed?
6. What follow-up tasks, owner, due dates, and completion evidence must be recorded?
7. Who reviews the audit trail and clinical safety events?

### Formal approvals required

- Clinical governance and credentialing approval of diagnosis authority, evidence, sign-off, terminology, amendment, and follow-up policies.
- Security approval of the technical enforcement and tests for role and encounter scope.
- No automated diagnosis, diagnosis status, or treatment action may be activated from Random Forest or SHAP output.

## 9. User accounts, login, and permissions

### Confirmed existing information

- Optional Supabase email/password authentication and a public account sign-up flow exist for the current application.
- Supabase row-level security in the existing migration applies to users' own prediction-history entries.
- This is not hospital staff provisioning, clinical RBAC, or authorization for patient records.
- The Flask research inference routes currently have no hospital staff-role authorization. CORS configuration is not authentication.

### Proposed requirements

- Prefer hospital-managed identity and staff provisioning; prohibit public self-registration for clinical staff accounts.
- Verify identity credentials on the backend, then authorize each action by active account, role, purpose, facility/team/encounter scope, and resource.
- Use deny-by-default least privilege, timely deprovisioning, auditable role changes, session expiry/revocation, and MFA/session controls according to hospital policy.
- Separate account administration from clinical access. Add break-glass only if the hospital approves the workflow, reason, duration, alerts, and retrospective audit.
- Enforce policy server-side for every protected API request; frontend guards are not security controls.

### Questions awaiting hospital answers

1. Which identity provider and authentication protocol are required?
2. How are staff onboarded, credentialed, assigned roles, suspended, and removed?
3. Which MFA, password/session, idle timeout, reauthentication, and device policies apply?
4. What role and attribute scopes are required by facility, department, care team, encounter, and purpose?
5. Is emergency/break-glass access needed? Who approves and reviews it?
6. Which identity and access events must be audited and retained?
7. Is the current Supabase project approved for any future clinical purpose? If not, which hospital service is required?

### Formal approvals required

- Hospital identity/IT owner approval of identity provider and integration.
- Clinical leadership approval of the role/action matrix and credential requirements.
- Security approval of authorization architecture, session controls, account lifecycle, and test evidence.
- Privacy/security approval of any proposed third-party identity or hosting provider.

## 10. Existing hospital software and database requirements

### Confirmed existing information

- The repository has an optional Supabase integration and a narrow prediction-history table, not a clinical patient schema.
- No hospital EHR, laboratory information system, patient master index, or database integration has been identified.
- No database choice for hospital clinical data has been approved.

### Proposed requirements

- First determine whether the hospital's existing EHR, patient master index, laboratory system, or data platform should remain the system of record.
- Prefer integration with authoritative hospital systems over duplicating records where feasible and approved.
- If a new store is justified, evaluate a relational database for structured patient/encounter relationships, constraints, transactions, and audit references; a PostgreSQL-compatible service is one candidate, not a selection.
- Define the authoritative owner for each data element, identifiers, terminology, interface/version, reconciliation, idempotency, retry, and error handling.
- Maintain versioned schema changes only after database, migration, access, retention, backup, and recovery approvals.

### Questions awaiting hospital answers

1. Which EHR, patient master index, laboratory system, identity system, and reporting systems are in use?
2. Which system is authoritative for each data domain?
3. Which interoperability standards, interface versions, profiles, and vendors are required?
4. Is a standalone clinical database allowed? Which database service and hosting model are approved?
5. Who owns database administration, schema changes, access reviews, patching, and data correction?
6. How are integration failures, duplicate messages, reconciliation, and downtime handled?
7. What data location, residency, vendor, processor, and cross-border transfer restrictions apply?

### Formal approvals required

- Hospital architecture/data-governance decision on system of record, database, integration, and data ownership.
- Security and privacy approval of hosting, provider, data flow, access model, and retention.
- Operations approval of service ownership, database support, migration/release practices, and recovery arrangements.
- No database is to be selected, created, migrated, or connected until these decisions are approved.

## 11. Privacy, security, and regulatory approvals

### Confirmed existing information

- Current project documentation describes an academic research system and does not claim NDPA compliance, hospital security approval, clinical validation, or regulatory clearance.
- No hospital privacy impact assessment, threat model, security review, medical-device determination, or ethics decision is recorded in the repository.

### Proposed requirements

- Conduct a data inventory and end-to-end data-flow review, threat model, privacy-impact assessment as determined by the hospital, and security risk assessment before real-data processing.
- Assess the Nigeria Data Protection Act 2023 and applicable NDPC rules/directives with qualified privacy/legal personnel; establish controller/processor roles, lawful processing, notices/rights, purpose, minimization, retention, breach, vendors, and transfer requirements.
- Obtain a qualified regulatory determination for the product's intended use and claims, including whether applicable medical-device/software-as-a-medical-device requirements or NAFDAC review/registration apply.
- Determine whether ethics committee/IRB or research-governance approval is needed before research access, linkage, or model evaluation using identifiable data.
- Require security testing, dependency and patch processes, incident response, access/audit review, encryption/key management, and approved vendor contracts before a pilot.
- Avoid PHI and secrets in source control, browser bundles, general logs, analytics, screenshots, and unapproved lower environments.

### Questions awaiting hospital answers

1. Who is the data controller, processor, and any subprocessor for each system component?
2. What lawful basis, notices, rights process, purpose limitation, retention, and deletion rules apply?
3. Is a DPIA or other privacy/regulator engagement required? Who determines and signs this?
4. Are any vendors or cross-border data transfers permitted, and under what contractual/security terms?
5. What breach notification, incident response, audit, and access-review timelines apply?
6. Does the intended use trigger medical-device/software regulation or NAFDAC review? Who will obtain the formal determination?
7. Is research ethics/IRB review required for pilot data collection, linkage, model display, or evaluation?
8. Which security standard, assessment, penetration test, vulnerability severity gates, and evidence are required?

### Formal approvals required

- Written privacy/legal determination and any required DPIA/NDPC actions before processing patient data.
- Written hospital security approval of architecture, threat model, controls, testing, and residual risk.
- Written ethics/research approval or determination that review is not required, before applicable research activity.
- Written regulatory determination and any necessary authorizations before making regulated claims or deploying regulated functionality.
- No compliance, clinical-validation, or regulatory approval claim may be made without documentary evidence and authorized wording.

## 12. Hosting, maintenance, and backup requirements

### Confirmed existing information

- The current backend run configuration is a local Flask development process bound to localhost by default.
- No hospital production hosting, HTTPS/domain configuration, production WSGI deployment, monitoring, service-level target, backup, or restore evidence is identified.

### Proposed requirements

- Deploy only in a hospital-approved production environment with TLS, managed secrets, restricted networking, environment separation, monitored services, and a supported production app server.
- Define release/change control, rollback, patching, dependency scanning, incident response, support ownership, and maintenance windows.
- Define backup scope, frequency, retention, encryption, key custody, access, and recovery location.
- Agree recovery point objective (RPO) and recovery time objective (RTO) with the hospital and test restoration at an agreed cadence.
- Keep production patient data out of development and test environments unless a separately approved data-protection process permits a transformed dataset.

### Questions awaiting hospital answers

1. Which hosting provider, network zone, domain, and data location are approved?
2. Who owns platform operations, monitoring, alert response, database administration, patching, and on-call support?
3. What uptime, performance, maintenance-window, and support-hour targets apply?
4. What are the hospital-approved RPO, RTO, backup frequency/retention, and restore-test schedule?
5. Who may access backups and recovery environments? How are encryption keys managed and rotated?
6. What are the release approval, rollback, change-management, vulnerability remediation, and incident escalation processes?
7. What training, service desk, downtime workflow, and continuity arrangements are required?

### Formal approvals required

- IT/operations and security approval of hosting, production topology, network access, secrets, monitoring, and service ownership.
- Data owner and privacy/security approval of backup data, location, access, retention, and deletion.
- Operations sign-off on tested backup restoration, incident response, rollback, and support runbooks before production use.

## 13. Hospital decisions, responsible persons, and approval signatures

No hospital decisions, names, dates, or approvals have been entered. The hospital should complete this register during discovery. Attach controlled decision records when space is insufficient.

| ID | Decision / requirement | Hospital answer or decision | Responsible person / role | Approving authority | Evidence / reference | Status | Date |
|---|---|---|---|---|---|---|---|
| D-01 | Intended use, pilot scope, population, prohibited uses |  |  |  |  | OPEN |  |
| D-02 | Clinical owner and clinical governance pathway |  |  |  |  | OPEN |  |
| D-03 | Screening instrument and approved version |  |  |  |  | OPEN |  |
| D-04 | Laboratory test catalogue, sources, units, provenance |  |  |  |  | OPEN |  |
| D-05 | Clinical interpretation and confirmation protocol |  |  |  |  | OPEN |  |
| D-06 | Clinician review, diagnosis authority, amendments, follow-up |  |  |  |  | OPEN |  |
| D-07 | Staff identity provider and account lifecycle |  |  |  |  | OPEN |  |
| D-08 | Role and facility/team/encounter permission matrix |  |  |  |  | OPEN |  |
| D-09 | Patient master identity, EHR/LIS, and system of record |  |  |  |  | OPEN |  |
| D-10 | Database, hosting, integration, and data location |  |  |  |  | OPEN |  |
| D-11 | Privacy basis, notices, retention, rights, DPIA decision |  |  |  |  | OPEN |  |
| D-12 | NDPA/NDPC, ethics, and regulatory determinations |  |  |  |  | OPEN |  |
| D-13 | Research model and SHAP inclusion/exclusion decision |  |  |  |  | OPEN |  |
| D-14 | Security controls, assessment, residual-risk acceptance |  |  |  |  | OPEN |  |
| D-15 | Production operations, RPO/RTO, backup and recovery |  |  |  |  | OPEN |  |
| D-16 | Pilot training, monitoring, stop conditions, go-live decision |  |  |  |  | OPEN |  |

### Approval signatures

Signatures confirm only the scope described in the referenced approval record. A signature on this requirements document does not, by itself, authorize patient-data processing or production deployment.

| Approval function | Name and title | Decision / conditions | Signature | Date | Evidence or approval reference |
|---|---|---|---|---|---|
| Hospital sponsor / management |  |  |  |  |  |
| Accountable clinical governance representative |  |  |  |  |  |
| Laboratory lead |  |  |  |  |  |
| Privacy officer / DPO / legal representative |  |  |  |  |  |
| Information security representative |  |  |  |  |  |
| IT / architecture / data owner |  |  |  |  |  |
| Operations / hosting / recovery owner |  |  |  |  |  |
| Ethics / research governance representative, if applicable |  |  |  |  |  |
| Regulatory representative or qualified counsel, if applicable |  |  |  |  |  |

**Overall decision:** ☐ Discovery may continue ☐ Requirements incomplete ☐ Do not proceed ☐ Other: __________  
**Conditions / outstanding actions:** __________________________________________________________  
**Authorized decision date:** ____________________  **Next review date:** ____________________

## 14. Information required before implementation checklist

Items remain **OPEN** until evidence or an authorized answer is recorded. Checking an item means the evidence has been reviewed and accepted by the named hospital authority; it does not mean a project team member merely believes it is complete.

### Governance and clinical

- [ ] **OPEN — Management answer:** named sponsor, accountable clinical owner, pilot site, departments, and project decision authority.
- [ ] **OPEN — Management approval:** signed intended-use statement, target population, scope, prohibited uses, and pilot boundaries.
- [ ] **OPEN — Clinical approval:** governing clinical protocol, source and exact version, local adaptations, responsible approvers, and change-control process.
- [ ] **OPEN — Clinical approval:** signed screening instrument, questions, response states, language, accessibility, and synthetic acceptance cases.
- [ ] **OPEN — Laboratory approval:** supported tests, identifiers, units, specimen/method metadata, source systems, quality assumptions, and correction workflows.
- [ ] **OPEN — Clinical/laboratory approval:** interpretation, confirmation, discordance, escalation, review, follow-up, and patient-facing wording specifications.
- [ ] **OPEN — Credentialing/clinical approval:** role-to-action matrix, diagnosis authority, sign-off, amendment, and review ownership.
- [ ] **OPEN — Research governance answer:** whether model/SHAP is excluded, researcher-only, or otherwise approved in the pilot.

### Data, identity, and architecture

- [ ] **OPEN — Data-owner answer:** authoritative patient identity source and approved identifiers/matching/duplicate resolution.
- [ ] **OPEN — Data-owner answer:** minimum necessary patient, encounter, assessment, laboratory, review, and audit fields.
- [ ] **OPEN — Architecture approval:** EHR/LIS/identity integrations, interface standards/versions, system of record, and ownership by data domain.
- [ ] **OPEN — Architecture approval:** identity provider, database choice, hosting/provider, network boundaries, data location, and vendor/subprocessor review.
- [ ] **OPEN — Security approval:** threat model, trust boundaries, encryption/key management, access controls, logging, audit, and testing requirements.
- [ ] **OPEN — Privacy/legal approval:** controller/processor roles, lawful basis, notices/rights, purpose, retention/deletion, export, and data-sharing approach.
- [ ] **OPEN — Privacy/legal determination:** DPIA/NDPA/NDPC requirements and any regulator engagement.
- [ ] **OPEN — Ethics determination:** research/IRB review required or not required, with written evidence before covered research activity.
- [ ] **OPEN — Regulatory determination:** applicable medical-device/software requirements and NAFDAC pathway, documented by authorized counsel/authority.

### Operations and approval to proceed

- [ ] **OPEN — Operations decision:** production environment, domain/TLS, service owner, supported app server, monitoring, support, patching, and release process.
- [ ] **OPEN — Operations decision:** RPO, RTO, backup scope/frequency/retention, restore-test schedule, and recovery ownership.
- [ ] **OPEN — Security/operations approval:** incident response, breach escalation, rollback, downtime, and continuity runbooks.
- [ ] **OPEN — Clinical/operations approval:** user training, competency/access prerequisites, pilot monitoring, safety measures, and stop conditions.
- [ ] **OPEN — Verification evidence:** synthetic-data authorization tests, protocol tests, integration/failure tests, accessibility/usability results, security test results, and backup restoration evidence.
- [ ] **OPEN — Written go/no-go:** all required approvals and residual-risk acceptance recorded; explicit authorization before any patient data or production pilot.

## 15. Current status and implementation gate

At the time this document is prepared:

- **Confirmed:** the project is an academic React/Vite and Flask research application with a Random Forest/SHAP workflow for the NHANES self-reported previous-diagnosis target.
- **Confirmed:** optional Supabase authentication and minimal prediction history exist, but they are not clinical-record authorization.
- **Confirmed:** hospital policy, intended use, clinical protocol, hospital identity/database/hosting choices, privacy/regulatory determinations, and named approvals have not been supplied in the project materials reviewed.
- **Proposed:** continue with hospital discovery and complete this document with authorized hospital representatives.
- **Approval required:** no clinical patient registration, laboratory interpretation, diagnosis workflow, real-patient model use, or production pilot until the applicable clinical, privacy, security, architecture, ethics/regulatory, and operational gates above are completed and documented.

Preserve the Faith Clinic name, HND II academic acknowledgement, existing model artifacts, datasets, and research results throughout planning and any separately approved future implementation.
