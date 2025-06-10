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

    // Timeout to prevent infinite loading
    const authTimeout = setTimeout(() => {
      console.warn('Auth loading timeout reached, forcing loading to false')
      setAuthState(prev => ({ ...prev, loading: false }))
    }, 10000) // 10 second timeout

    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('Getting initial session...')
        
        // Check if we have a code parameter for PKCE flow
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        
        if (code) {
          console.log('Found auth code, attempting PKCE exchange...')
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code)
            
            if (error) {
              console.error('PKCE exchange error:', error)
              // Clean up the URL
              window.history.replaceState({}, document.title, window.location.pathname)
              setAuthState(prev => ({ ...prev, error: error.message, loading: false }))
              return
            }
            
            if (data.session?.user) {
              console.log('PKCE exchange successful, user authenticated:', data.session.user.id)
              // Clean up the URL
              cleanUpUrl()
              window.history.replaceState({}, document.title, window.location.pathname)
              
              // Fetch user profile
              const { data: userProfile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.session.user.id)
                .single()

              if (profileError && profileError.code !== 'PGRST116') {
                console.error('Error fetching user profile:', profileError)
              }

              clearTimeout(authTimeout)
              setAuthState({
                user: data.session.user,
                userProfile: userProfile || null,
                session: data.session,
                loading: false,
                error: null
              })
              return
            }
          } catch (pkceError) {
            console.error('PKCE exchange failed:', pkceError)
            // Clean up the URL and continue with normal session check
            window.history.replaceState({}, document.title, window.location.pathname)
          }
        }
        
        // Normal session check
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          setAuthState(prev => ({ ...prev, error: error.message, loading: false }))
          return
        }

        if (session?.user) {
          console.log('Session found, user authenticated:', session.user.id)
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

          clearTimeout(authTimeout)
          setAuthState({
            user: session.user,
            userProfile: userProfile || null,
            session,
            loading: false,
            error: null
          })
        } else {
          console.log('No session found, user not authenticated')
          clearTimeout(authTimeout)
          setAuthState({
            user: null,
            userProfile: null,
            session: null,
            loading: false,
            error: null
          })
        }
      } catch (error) {
        console.error('Unexpected error in getInitialSession:', error)
        clearTimeout(authTimeout)
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

    return () => {
      subscription.unsubscribe()
      clearTimeout(authTimeout)
    }
  }, [])

  const signInWithGoogle = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }))
      
      // Always use production URL for OAuth redirect
      const redirectUrl = 'https://t3-oss.netlify.app/auth/callback'
      
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