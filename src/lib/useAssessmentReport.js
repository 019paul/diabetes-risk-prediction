import { useContext } from 'react'
import { AssessmentContext } from './contexts.js'

export function useAssessmentReport() {
  const value = useContext(AssessmentContext)
  if (!value) throw new Error('useAssessmentReport must be used inside AssessmentProvider.')
  return value
}
