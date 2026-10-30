export const DEMO_SEX_OPTIONS = ['Female', 'Male', 'Prefer not to say']

export const INITIAL_DEMO_PATIENTS = [
  {
    id: 'FC-DEMO-0001',
    firstName: 'Synthetic Demo',
    lastName: 'Patient One',
    dateOfBirth: '1990-04-12',
    sex: 'Female',
    phone: '0000000001',
    email: 'demo.patient.one@example.invalid',
    address: 'Synthetic demonstration address',
    registrationDate: '2026-10-28',
    status: 'active',
    synthetic: true,
  },
  {
    id: 'FC-DEMO-0002',
    firstName: 'Synthetic Demo',
    lastName: 'Patient Two',
    dateOfBirth: '1984-09-03',
    sex: 'Male',
    phone: '0000000002',
    email: '',
    address: '',
    registrationDate: '2026-10-29',
    status: 'active',
    synthetic: true,
  },
]

export function getLocalDateString(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

export function formatDemoPatientId(sequence) {
  return `FC-DEMO-${String(sequence).padStart(4, '0')}`
}

export function validatePatientForm(values, today = getLocalDateString()) {
  const errors = {}
  const firstName = String(values.firstName ?? '').trim()
  const lastName = String(values.lastName ?? '').trim()
  const dateOfBirth = String(values.dateOfBirth ?? '')
  const sex = String(values.sex ?? '')
  const parsedDate = new Date(`${dateOfBirth}T00:00:00.000Z`)
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
    && !Number.isNaN(parsedDate.getTime())
    && parsedDate.toISOString().slice(0, 10) === dateOfBirth

  if (!firstName) errors.firstName = 'Enter a first name.'
  if (!lastName) errors.lastName = 'Enter a last name.'
  if (!validDate) {
    errors.dateOfBirth = 'Enter a valid date of birth.'
  } else if (dateOfBirth > today) {
    errors.dateOfBirth = 'Date of birth cannot be in the future.'
  }
  if (!DEMO_SEX_OPTIONS.includes(sex)) {
    errors.sex = 'Select one of the provisional options.'
  }

  return errors
}

export function createPatientRecord(values, id, registrationDate) {
  return {
    id,
    firstName: String(values.firstName).trim(),
    lastName: String(values.lastName).trim(),
    dateOfBirth: values.dateOfBirth,
    sex: values.sex,
    phone: String(values.phone ?? '').trim(),
    email: String(values.email ?? '').trim(),
    address: String(values.address ?? '').trim(),
    registrationDate,
    status: 'active',
    synthetic: true,
  }
}

export function searchPatients(patients, query, statusFilter = 'all') {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return patients.filter((patient) => {
    const matchesStatus = statusFilter === 'all' || patient.status === statusFilter
    const searchableText = [
      patient.id,
      patient.firstName,
      patient.lastName,
      `${patient.firstName} ${patient.lastName}`,
    ].join(' ').toLocaleLowerCase()

    return matchesStatus && (!normalizedQuery || searchableText.includes(normalizedQuery))
  })
}
