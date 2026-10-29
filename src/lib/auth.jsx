import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { AuthContext } from './contexts.js'
import { isSupabaseConfigured, supabase } from './supabase'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let active = true
    supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return
        if (sessionError) setError(sessionError.message)
        setSession(data.session)
        setReady(true)
      })
      .catch((sessionError) => {
        if (!active) return
        setError(sessionError.message || 'Could not check the authentication session.')
        setReady(true)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession)
        setError('')
        setReady(true)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({
    configured: isSupabaseConfigured,
    ready,
    user: session?.user ?? null,
    error,
    signIn: async (email, password) => {
      if (!supabase) throw new Error('Supabase authentication is not configured.')
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      return data
    },
    signUp: async (email, password) => {
      if (!supabase) throw new Error('Supabase authentication is not configured.')
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) throw signUpError
      return data
    },
    signOut: async () => {
      if (!supabase) throw new Error('Supabase authentication is not configured.')
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
    },
  }), [error, ready, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}