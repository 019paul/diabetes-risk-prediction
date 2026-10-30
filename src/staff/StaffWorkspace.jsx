import { createContext, useContext, useMemo, useRef, useState } from 'react'
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom'
import {
  DEMO_SEX_OPTIONS,
  createPatientRecord,
  formatDemoPatientId,
  getLocalDateString,
  INITIAL_DEMO_PATIENTS,
  searchPatients,
  validatePatientForm,
} from './patientRecords.js'
import './StaffWorkspace.css'

const PatientWorkspaceContext = createContext(null)

function PatientWorkspaceProvider({ children }) {
  const [patients, setPatients] = useState(() => INITIAL_DEMO_PATIENTS.map((patient) => ({ ...patient })))
  const nextPatientNumber = useRef(INITIAL_DEMO_PATIENTS.length + 1)

  const value = useMemo(() => ({
    patients,
    findPatient: (id) => patients.find((patient) => patient.id === id),
    registerPatient: (values) => {
      const patient = createPatientRecord(
        values,
        formatDemoPatientId(nextPatientNumber.current),
        getLocalDateString(),
      )
      nextPatientNumber.current += 1
      setPatients((current) => [patient, ...current])
      return patient
    },
    updatePatient: (id, values) => {
      setPatients((current) => current.map((patient) => {
        if (patient.id !== id) return patient
        return {
          ...patient,
          firstName: String(values.firstName).trim(),
          lastName: String(values.lastName).trim(),
          dateOfBirth: values.dateOfBirth,
          sex: values.sex,
          phone: String(values.phone ?? '').trim(),
          email: String(values.email ?? '').trim(),
          address: String(values.address ?? '').trim(),
        }
      }))
    },
    setPatientStatus: (id, status) => {
      setPatients((current) => current.map((patient) => (
        patient.id === id ? { ...patient, status } : patient
      )))
    },
  }), [patients])

  return (
    <PatientWorkspaceContext.Provider value={value}>
      {children}
    </PatientWorkspaceContext.Provider>
  )
}

function usePatientWorkspace() {
  const value = useContext(PatientWorkspaceContext)
  if (!value) {
    throw new Error('Patient workspace pages must be rendered inside PatientWorkspaceProvider.')
  }
  return value
}

function SyntheticBadge() {
  return <span className="staff-synthetic-badge">SYNTHETIC DEMO</span>
}

function StaffPageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="staff-page-heading">
      <div>
        <span className="staff-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function StaffLayout() {
  return (
    <div className="staff-workspace">
      <header className="staff-header">
        <div className="staff-header-inner">
          <Link aria-label="Faith Clinic staff workspace home" className="staff-brand" to="/staff">
            <span aria-hidden="true" className="staff-brand-mark">FC</span>
            <span>
              <strong>Faith Clinic</strong>
              <small>HOSPITAL WORKSPACE PROTOTYPE</small>
            </span>
          </Link>
          <Link className="staff-public-link" to="/">Back to research website</Link>
        </div>
        <nav aria-label="Hospital workspace navigation" className="staff-navigation">
          <NavLink end to="/staff">Overview</NavLink>
          <NavLink to="/staff/patients">Patient directory</NavLink>
          <NavLink to="/staff/patients/new">Register patient</NavLink>
        </nav>
      </header>

      <div className="staff-demo-warning" role="note">
        <strong>Prototype only — synthetic demonstration records only.</strong>
        <span>
          No staff authentication or backend authorization is active. Records exist only in
          memory and reset when this workspace is reloaded. Never enter real patient information.
        </span>
      </div>

      <section aria-label="Hospital workspace content" className="staff-main-content">
        <Routes>
          <Route element={<StaffDashboard />} index />
          <Route element={<PatientDirectory />} path="patients" />
          <Route element={<PatientForm />} path="patients/new" />
          <Route element={<PatientProfile />} path="patients/:patientId" />
          <Route element={<EditPatientRoute />} path="patients/:patientId/edit" />
          <Route element={<StaffNotFound />} path="*" />
        </Routes>
      </section>

      <footer className="staff-footer">
        Faith Clinic · HND II academic project · Hospital workspace prototype
      </footer>
    </div>
  )
}

function StaffDashboard() {
  const { patients } = usePatientWorkspace()
  const activeCount = patients.filter((patient) => patient.status === 'active').length
  const archivedCount = patients.length - activeCount

  return (
    <div className="staff-page">
      <StaffPageHeading
        action={<Link className="staff-button" to="/staff/patients/new">Register synthetic patient</Link>}
        description="A separate prototype workspace for demonstrating patient registration and record navigation."
        eyebrow="STAFF WORKSPACE · DEMONSTRATION"
        title="Workspace overview"
      />

      <div className="staff-status-panel">
        <div className="staff-status-icon" aria-hidden="true">!</div>
        <div>
          <h2>This is not a hospital-approved patient record system</h2>
          <p>
            The fields and categories are provisional. There are no encounters, laboratory
            results, screening records, clinical reviews, or diagnosis functions.
          </p>
        </div>
      </div>

      <div aria-label="Synthetic demonstration record counts" className="staff-stat-grid">
        <article className="staff-stat-card">
          <span>Active demo records</span>
          <strong>{activeCount}</strong>
          <small>Synthetic records held in memory</small>
        </article>
        <article className="staff-stat-card">
          <span>Archived demo records</span>
          <strong>{archivedCount}</strong>
          <small>Archived records can be restored</small>
        </article>
        <article className="staff-stat-card">
          <span>Clinical workflows</span>
          <strong>Not available</strong>
          <small>Awaiting hospital-approved requirements</small>
        </article>
      </div>

      <div className="staff-dashboard-grid">
        <article className="staff-panel staff-action-panel">
          <SyntheticBadge />
          <h2>Patient records</h2>
          <p>Search the synthetic directory, review provisional demographic fields, or register a new demo record.</p>
          <div className="staff-action-row">
            <Link className="staff-button" to="/staff/patients">Open patient directory</Link>
            <Link className="staff-button staff-button-secondary" to="/staff/patients/new">Register patient</Link>
          </div>
        </article>
        <article className="staff-panel">
          <span className="staff-eyebrow">NOT IMPLEMENTED</span>
          <h2>Clinical record sections</h2>
          <ul className="staff-placeholder-list">
            <li>Encounter history</li>
            <li>Diabetes screening history</li>
            <li>Laboratory results and interpretation</li>
            <li>Clinician review and diagnosis</li>
          </ul>
          <p className="staff-help-text">These sections remain inactive until the hospital approves their workflows and data requirements.</p>
        </article>
      </div>
    </div>
  )
}

function PatientDirectory() {
  const { patients, setPatientStatus } = usePatientWorkspace()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const matchingPatients = searchPatients(patients, query, statusFilter)

  function archivePatient(patient) {
    const confirmed = window.confirm(
      `Archive synthetic demonstration record ${patient.id}? This will hide it from the active directory. It will not be permanently deleted.`,
    )
    if (confirmed) setPatientStatus(patient.id, 'archived')
  }

  return (
    <div className="staff-page">
      <StaffPageHeading
        action={<Link className="staff-button" to="/staff/patients/new">Register patient</Link>}
        description="Search by demonstration patient ID or name. All records shown here are synthetic."
        eyebrow="PATIENT RECORDS · SYNTHETIC DATA"
        title="Patient directory"
      />

      <div className="staff-directory-tools">
        <div className="staff-search-field">
          <label htmlFor="patient-search">Search patient ID or name</label>
          <input
            autoComplete="off"
            id="patient-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. FC-DEMO-0001 or Demo Patient"
            type="search"
            value={query}
          />
        </div>
        <div className="staff-filter-field">
          <label htmlFor="patient-status-filter">Record status</label>
          <select
            id="patient-status-filter"
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All records</option>
          </select>
        </div>
      </div>

      {matchingPatients.length === 0
        ? <div className="staff-empty-state">
            <span aria-hidden="true" className="staff-empty-icon">⌕</span>
            <h2>{patients.length === 0 ? 'No synthetic records yet' : 'No matching records'}</h2>
            <p>{patients.length === 0
              ? 'Register a synthetic demonstration record to preview the directory.'
              : 'Try a different patient ID or name, or change the record-status filter.'}</p>
            {patients.length === 0 && <Link className="staff-button" to="/staff/patients/new">Register synthetic record</Link>}
          </div>
        : <div aria-label="Synthetic patient records" className="staff-patient-grid">
            {matchingPatients.map((patient) => (
              <article className="staff-patient-card" key={patient.id}>
                <div className="staff-patient-card-top">
                  <span className="staff-avatar" aria-hidden="true">
                    {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
                  </span>
                  <div className="staff-patient-card-title">
                    <h2>{patient.firstName} {patient.lastName}</h2>
                    <span>{patient.id}</span>
                  </div>
                  <SyntheticBadge />
                </div>
                <dl className="staff-patient-summary">
                  <div><dt>Date of birth</dt><dd>{formatDate(patient.dateOfBirth)}</dd></div>
                  <div><dt>Sex (provisional)</dt><dd>{patient.sex}</dd></div>
                  <div><dt>Registered</dt><dd>{formatDate(patient.registrationDate)}</dd></div>
                </dl>
                <div className="staff-patient-card-bottom">
                  <span className={`staff-record-status staff-record-status-${patient.status}`}>{patient.status}</span>
                  <Link className="staff-text-link" to={`/staff/patients/${patient.id}`}>View profile</Link>
                  <Link aria-label={`Edit ${patient.firstName} ${patient.lastName}`} className="staff-text-link" to={`/staff/patients/${patient.id}/edit`}>Edit</Link>
                </div>
                {patient.status === 'active' && (
                  <button className="staff-quiet-action" onClick={() => archivePatient(patient)} type="button">
                    Archive demo record
                  </button>
                )}
              </article>
            ))}
          </div>}
    </div>
  )
}

function EditPatientRoute() {
  const { patientId } = useParams()
  const { findPatient } = usePatientWorkspace()
  const patient = findPatient(patientId)
  if (!patient) return <PatientNotFound patientId={patientId} />
  return <PatientForm key={patient.id} patient={patient} />
}

function PatientForm({ patient = null }) {
  const navigate = useNavigate()
  const { registerPatient, updatePatient } = usePatientWorkspace()
  const today = getLocalDateString()
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [values, setValues] = useState(() => ({
    firstName: patient?.firstName ?? '',
    lastName: patient?.lastName ?? '',
    dateOfBirth: patient?.dateOfBirth ?? '',
    sex: patient?.sex ?? '',
    phone: patient?.phone ?? '',
    email: patient?.email ?? '',
    address: patient?.address ?? '',
  }))

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setFormError('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    if (!form.reportValidity()) {
      form.querySelector(':invalid')?.focus()
      return
    }

    const validationErrors = validatePatientForm(values, today)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setFormError('Review the highlighted fields before saving.')
      form.elements.namedItem(Object.keys(validationErrors)[0])?.focus()
      return
    }

    let savedPatient
    if (patient) {
      updatePatient(patient.id, values)
      savedPatient = patient
    } else {
      savedPatient = registerPatient(values)
    }
    navigate(`/staff/patients/${savedPatient.id}`, { replace: true })
  }

  const fieldError = (name) => errors[name]

  return (
    <div className="staff-page">
      <StaffPageHeading
        description="This form uses provisional demographic fields and stores synthetic values in page memory only."
        eyebrow="PATIENT RECORDS · SYNTHETIC DATA"
        title={patient ? 'Edit demonstration record' : 'Register synthetic patient'}
      />

      <div className="staff-form-notice" role="note">
        <strong>Provisional fields — hospital review required.</strong>
        <span>Field definitions and sex categories are not final hospital requirements.</span>
      </div>

      {patient && (
        <div className="staff-id-banner">
          <span>Demonstration patient ID</span>
          <strong>{patient.id}</strong>
          <SyntheticBadge />
        </div>
      )}

      <form className="staff-panel staff-patient-form" noValidate onSubmit={handleSubmit}>
        <div className="staff-form-grid">
          <div className="staff-form-field">
            <label htmlFor="patient-first-name">First name <span aria-hidden="true">*</span></label>
            <input
              autoComplete="off"
              id="patient-first-name"
              maxLength={80}
              name="firstName"
              onChange={handleChange}
              required
              value={values.firstName}
              aria-describedby={fieldError('firstName') ? 'patient-first-name-error' : undefined}
              aria-invalid={Boolean(fieldError('firstName'))}
            />
            {fieldError('firstName') && <span className="staff-field-error" id="patient-first-name-error">{fieldError('firstName')}</span>}
          </div>
          <div className="staff-form-field">
            <label htmlFor="patient-last-name">Last name <span aria-hidden="true">*</span></label>
            <input
              autoComplete="off"
              id="patient-last-name"
              maxLength={80}
              name="lastName"
              onChange={handleChange}
              required
              value={values.lastName}
              aria-describedby={fieldError('lastName') ? 'patient-last-name-error' : undefined}
              aria-invalid={Boolean(fieldError('lastName'))}
            />
            {fieldError('lastName') && <span className="staff-field-error" id="patient-last-name-error">{fieldError('lastName')}</span>}
          </div>
          <div className="staff-form-field">
            <label htmlFor="patient-date-of-birth">Date of birth <span aria-hidden="true">*</span></label>
            <input
              autoComplete="off"
              id="patient-date-of-birth"
              max={today}
              name="dateOfBirth"
              onChange={handleChange}
              required
              type="date"
              value={values.dateOfBirth}
              aria-describedby={fieldError('dateOfBirth') ? 'patient-date-of-birth-error' : 'patient-date-of-birth-help'}
              aria-invalid={Boolean(fieldError('dateOfBirth'))}
            />
            {fieldError('dateOfBirth')
              ? <span className="staff-field-error" id="patient-date-of-birth-error">{fieldError('dateOfBirth')}</span>
              : <span className="staff-field-help" id="patient-date-of-birth-help">Provisional field; final data requirements await hospital approval.</span>}
          </div>
          <div className="staff-form-field">
            <label htmlFor="patient-sex">Sex <span aria-hidden="true">*</span></label>
            <select
              id="patient-sex"
              name="sex"
              onChange={handleChange}
              required
              value={values.sex}
              aria-describedby={fieldError('sex') ? 'patient-sex-error' : 'patient-sex-help'}
              aria-invalid={Boolean(fieldError('sex'))}
            >
              <option value="">Select a provisional option</option>
              {DEMO_SEX_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            {fieldError('sex')
              ? <span className="staff-field-error" id="patient-sex-error">{fieldError('sex')}</span>
              : <span className="staff-field-help" id="patient-sex-help">Provisional categories; hospital review required.</span>}
          </div>
          <div className="staff-form-field">
            <label htmlFor="patient-phone">Phone number</label>
            <input
              autoComplete="off"
              id="patient-phone"
              maxLength={30}
              name="phone"
              onChange={handleChange}
              type="tel"
              value={values.phone}
            />
          </div>
          <div className="staff-form-field">
            <label htmlFor="patient-email">Email <span className="staff-optional-label">Optional</span></label>
            <input
              autoComplete="off"
              id="patient-email"
              maxLength={254}
              name="email"
              onChange={handleChange}
              type="email"
              value={values.email}
            />
          </div>
          <div className="staff-form-field staff-form-field-wide">
            <label htmlFor="patient-address">Address <span className="staff-optional-label">Optional</span></label>
            <textarea
              autoComplete="off"
              id="patient-address"
              maxLength={240}
              name="address"
              onChange={handleChange}
              rows={3}
              value={values.address}
            />
          </div>
        </div>

        {formError && <p className="staff-form-error" role="alert">{formError}</p>}

        <div className="staff-form-actions">
          <button className="staff-button" type="submit">{patient ? 'Save demographic changes' : 'Create synthetic record'}</button>
          <Link className="staff-button staff-button-secondary" to={patient ? `/staff/patients/${patient.id}` : '/staff/patients'}>Cancel</Link>
        </div>
        <p className="staff-help-text">Patient ID and registration date are generated by the prototype and cannot be edited.</p>
      </form>
    </div>
  )
}

function PatientProfile() {
  const { patientId } = useParams()
  const { findPatient, setPatientStatus } = usePatientWorkspace()
  const patient = findPatient(patientId)

  if (!patient) return <PatientNotFound patientId={patientId} />

  function changeRecordStatus() {
    const nextStatus = patient.status === 'active' ? 'archived' : 'active'
    const action = nextStatus === 'archived' ? 'Archive' : 'Restore'
    const confirmed = window.confirm(
      `${action} synthetic demonstration record ${patient.id}? No record will be permanently deleted.`,
    )
    if (confirmed) setPatientStatus(patient.id, nextStatus)
  }

  return (
    <div className="staff-page">
      <div className="staff-profile-back">
        <Link className="staff-text-link" to="/staff/patients">← Back to patient directory</Link>
      </div>
      <StaffPageHeading
        action={<Link className="staff-button" to={`/staff/patients/${patient.id}/edit`}>Edit demographics</Link>}
        description="Synthetic demonstration profile. No clinical diagnosis or treatment advice is available."
        eyebrow="PATIENT PROFILE · SYNTHETIC DATA"
        title={`${patient.firstName} ${patient.lastName}`}
      />

      <div className="staff-profile-id-card">
        <div>
          <span className="staff-eyebrow">DEMONSTRATION PATIENT ID</span>
          <strong>{patient.id}</strong>
        </div>
        <SyntheticBadge />
        <span className={`staff-record-status staff-record-status-${patient.status}`}>{patient.status}</span>
      </div>

      <section aria-labelledby="personal-information-title" className="staff-panel staff-profile-panel">
        <div className="staff-section-heading">
          <div><span className="staff-eyebrow">PROVISIONAL DEMOGRAPHICS</span><h2 id="personal-information-title">Personal information</h2></div>
          <Link className="staff-text-link" to={`/staff/patients/${patient.id}/edit`}>Edit information</Link>
        </div>
        <dl className="staff-profile-details">
          <div><dt>First name</dt><dd>{patient.firstName}</dd></div>
          <div><dt>Last name</dt><dd>{patient.lastName}</dd></div>
          <div><dt>Date of birth</dt><dd>{formatDate(patient.dateOfBirth)}</dd></div>
          <div><dt>Sex (provisional)</dt><dd>{patient.sex}</dd></div>
          <div><dt>Phone</dt><dd>{patient.phone || 'Not provided'}</dd></div>
          <div><dt>Email</dt><dd>{patient.email || 'Not provided'}</dd></div>
          <div className="staff-profile-detail-wide"><dt>Address</dt><dd>{patient.address || 'Not provided'}</dd></div>
          <div><dt>Registration date</dt><dd>{formatDate(patient.registrationDate)}</dd></div>
          <div><dt>Record status</dt><dd>{patient.status}</dd></div>
        </dl>
        <p className="staff-help-text">All fields and categories are provisional and await hospital approval.</p>
      </section>

      <div className="staff-profile-section-grid">
        <PlaceholderSection title="Encounter history" description="Encounter creation and history are not implemented." />
        <PlaceholderSection title="Screening history" description="No screening assessments are stored in this prototype." />
        <PlaceholderSection title="Laboratory results" description="Laboratory capture and interpretation are not implemented." />
        <PlaceholderSection title="Clinician review" description="Clinician review and diagnosis documentation are not implemented." />
      </div>

      <div className="staff-profile-actions">
        <button className="staff-button staff-button-secondary" onClick={changeRecordStatus} type="button">
          {patient.status === 'active' ? 'Archive synthetic record' : 'Restore synthetic record'}
        </button>
        <span>Archiving is reversible. Permanent deletion is not available in this prototype.</span>
      </div>
    </div>
  )
}

function PlaceholderSection({ title, description }) {
  return (
    <section className="staff-panel staff-placeholder-card">
      <span className="staff-placeholder-tag">NOT IMPLEMENTED</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  )
}

function PatientNotFound({ patientId }) {
  return (
    <div className="staff-empty-state">
      <span className="staff-eyebrow">RECORD UNAVAILABLE</span>
      <h1>Patient record not found</h1>
      <p>{patientId ? `No synthetic demonstration record matches ${patientId}.` : 'The requested synthetic record is unavailable.'}</p>
      <Link className="staff-button" to="/staff/patients">Return to directory</Link>
    </div>
  )
}

function StaffNotFound() {
  return (
    <div className="staff-empty-state">
      <span className="staff-eyebrow">WORKSPACE PAGE NOT FOUND</span>
      <h1>This workspace page is not available</h1>
      <p>Choose an available staff workspace section.</p>
      <Link className="staff-button" to="/staff">Return to workspace overview</Link>
    </div>
  )
}

function formatDate(value) {
  if (!value) return 'Not provided'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? 'Not provided'
    : new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date)
}

export default function StaffWorkspace() {
  return (
    <PatientWorkspaceProvider>
      <StaffLayout />
    </PatientWorkspaceProvider>
  )
}
