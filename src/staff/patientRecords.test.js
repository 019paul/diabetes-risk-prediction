import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPatientRecord,
  formatDemoPatientId,
  INITIAL_DEMO_PATIENTS,
  searchPatients,
  validatePatientForm,
} from './patientRecords.js'

const validForm = {
  firstName: '  Test ',
  lastName: ' Patient ',
  dateOfBirth: '2000-02-29',
  sex: 'Prefer not to say',
  phone: '0000000000',
  email: 'test@example.invalid',
  address: 'Synthetic address',
}

test('provisional patient form accepts valid synthetic demographics', () => {
  assert.deepEqual(validatePatientForm(validForm, '2026-10-30'), {})
})

test('patient form rejects missing names, invalid dates, future dates, and unknown options', () => {
  const errors = validatePatientForm({
    firstName: ' ',
    lastName: '',
    dateOfBirth: '2027-02-30',
    sex: 'Unapproved option',
  }, '2026-10-30')

  assert.equal(errors.firstName, 'Enter a first name.')
  assert.equal(errors.lastName, 'Enter a last name.')
  assert.equal(errors.dateOfBirth, 'Enter a valid date of birth.')
  assert.equal(errors.sex, 'Select one of the provisional options.')
  assert.equal(
    validatePatientForm({ ...validForm, dateOfBirth: '2027-01-01' }, '2026-10-30').dateOfBirth,
    'Date of birth cannot be in the future.',
  )
})

test('new records retain synthetic status and a generated demonstration identifier', () => {
  const record = createPatientRecord(validForm, formatDemoPatientId(3), '2026-10-30')

  assert.equal(record.id, 'FC-DEMO-0003')
  assert.equal(record.firstName, 'Test')
  assert.equal(record.lastName, 'Patient')
  assert.equal(record.synthetic, true)
  assert.equal(record.status, 'active')
  assert.equal(record.registrationDate, '2026-10-30')
})

test('patient directory searches identifier and name and filters archived records', () => {
  const patients = [
    ...INITIAL_DEMO_PATIENTS,
    { ...INITIAL_DEMO_PATIENTS[0], id: 'FC-DEMO-0003', status: 'archived' },
  ]

  assert.deepEqual(searchPatients(patients, '0002').map(({ id }) => id), ['FC-DEMO-0002'])
  assert.deepEqual(searchPatients(patients, 'patient one').map(({ id }) => id), ['FC-DEMO-0001', 'FC-DEMO-0003'])
  assert.deepEqual(searchPatients(patients, '', 'active').map(({ id }) => id), ['FC-DEMO-0001', 'FC-DEMO-0002'])
  assert.deepEqual(searchPatients(patients, '', 'archived').map(({ id }) => id), ['FC-DEMO-0003'])
})
