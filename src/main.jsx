import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AssessmentProvider } from './lib/assessment.jsx'
import { AuthProvider } from './lib/auth.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <AssessmentProvider>
        <App />
      </AssessmentProvider>
    </AuthProvider>
  </StrictMode>,
)
