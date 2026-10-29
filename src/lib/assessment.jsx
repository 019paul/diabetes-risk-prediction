import { useMemo, useState } from 'react'
import { AssessmentContext } from './contexts.js'

export function AssessmentProvider({ children }) {
  const [report, setReport] = useState(null)
  const value = useMemo(() => ({ report, setReport }), [report])
  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>
}
