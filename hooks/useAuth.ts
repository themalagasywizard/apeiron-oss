import { useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { User as AppUser } from '@/lib/database.types'

export interface AuthState {
  user: User | null
  userProfile: AppUser | null
  session: Session | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    userProfile: null,
    session: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    // Clean up URL fragments after auth
    const cleanUpUrl = () => {
      if (typeof window !== 'undefined') {
        const currentUrl = window.location.href
        if (currentUrl.includes('#access_token=') || currentUrl.includes('#error=')) {
          // Clean up the URL by removing the fragment
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
        }
      }
    }

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          setAuthState(prev => ({ ...prev, error: error.message, loading: false }))
          return
        }

        if (session?.user) {
          // Clean up URL after successful authentication
          cleanUpUrl()
          
          // Fetch user profile
          const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error fetching user profile:', profileError)
          }

          setAuthState({
            user: session.user,
            userProfile: userProfile || null,
            session,
            loading: false,
            error: null
          })
        } else {
          setAuthState({
            user: null,
            userProfile: null,
            session: null,
            loading: false,
            error: null
          })
        }
      } catch (error) {
        setAuthState(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : 'Unknown error',
          loading: false 
        }))
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Clean up URL after successful authentication
          cleanUpUrl()
          
          // Fetch user profile
          const { data: userProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()

          setAuthState({
            user: session.user,
            userProfile: userProfile || null,
            session,
            loading: false,
            error: null
          })
        } else if (event === 'SIGNED_OUT') {
          setAuthState({
            user: null,
            userProfile: null,
            session: null,
            loading: false,
            error: null
          })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }))
      
      // Determine the redirect URL - use production URL for deployed app
      const isProduction = window.location.hostname !== 'localhost'
      const redirectUrl = isProduction 
        ? 'https://t3-oss.netlify.app/auth/callback'
        : `${window.location.origin}/auth/callback`
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
        }
      })

      if (error) {
        setAuthState(prev => ({ ...prev, error: error.message, loading: false }))
      }
    } catch (error) {
      setAuthState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false 
      }))
    }
  }

  const signOut = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }))
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        setAuthState(prev => ({ ...prev, error: error.message, loading: false }))
      }
    } catch (error) {
      setAuthState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false 
      }))
    }
  }

  const updateProfile = async (updates: Partial<AppUser>) => {
    if (!authState.user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', authState.user.id)
        .select()
        .single()

      if (error) throw error

      setAuthState(prev => ({ ...prev, userProfile: data }))
      return data
    } catch (error) {
      console.error('Error updating profile:', error)
      throw error
    }
  }

  return {
    ...authState,
    signInWithGoogle,
    signOut,
    updateProfile,
    isAuthenticated: !!authState.user
  }
} 