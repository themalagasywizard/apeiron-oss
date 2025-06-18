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
          console.log('Found auth code, attempting PKCE exchange...', code.substring(0, 8) + '...')
          try {
            console.log('Calling supabase.auth.exchangeCodeForSession...')
            const { data, error } = await Promise.race([
              supabase.auth.exchangeCodeForSession(code),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('PKCE exchange timeout')), 8000)
              )
            ]) as any
            
            console.log('PKCE exchange response:', { data: !!data, error: !!error })
            
            if (error) {
              console.error('PKCE exchange error:', error)
              // Clean up the URL
              window.history.replaceState({}, document.title, window.location.pathname)
              clearTimeout(authTimeout)
              setAuthState(prev => ({ ...prev, error: error.message, loading: false }))
              return
            }
            
            if (data?.session?.user) {
              console.log('PKCE exchange successful, user authenticated:', data.session.user.id)
              // Clean up the URL
              cleanUpUrl()
              window.history.replaceState({}, document.title, window.location.pathname)
              
              // Fetch user profile
              try {
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
              } catch (profileError) {
                console.error('Error fetching user profile:', profileError)
                // Continue with user but no profile
                clearTimeout(authTimeout)
                setAuthState({
                  user: data.session.user,
                  userProfile: null,
                  session: data.session,
                  loading: false,
                  error: null
                })
                return
              }
            } else {
              console.warn('PKCE exchange completed but no session data received')
              // Clean up URL and continue with normal session check
              window.history.replaceState({}, document.title, window.location.pathname)
            }
          } catch (pkceError) {
            console.error('PKCE exchange failed:', pkceError)
            // Clean up the URL and continue with normal session check
            window.history.replaceState({}, document.title, window.location.pathname)
          }
        }
        
        // Normal session check - this might find the session after PKCE success
        console.log('Performing normal session check...')
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          clearTimeout(authTimeout)
          setAuthState(prev => ({ ...prev, error: error.message, loading: false }))
          return
        }

        if (session?.user) {
          console.log('Session found, user authenticated:', session.user.id)
          // Clean up URL after successful authentication
          cleanUpUrl()
          
          try {
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
          } catch (profileError) {
            console.error('Error in profile fetch:', profileError)
            // Continue with user but no profile
            clearTimeout(authTimeout)
            setAuthState({
              user: session.user,
              userProfile: null,
              session,
              loading: false,
              error: null
            })
          }
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
        console.log('Auth state change event:', event, !!session)
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('SIGNED_IN event detected, user:', session.user.id)
          // Clean up URL after successful authentication
          cleanUpUrl()
          
          // Set auth state immediately to prevent timeout
          clearTimeout(authTimeout)
          setAuthState({
            user: session.user,
            userProfile: null, // Will be loaded separately
            session,
            loading: false,
            error: null
          })
          
          // Fetch user profile asynchronously (non-blocking)
          setTimeout(async () => {
            try {
              console.log('Fetching user profile...')
              const { data: userProfile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single()

              if (profileError) {
                if (profileError.code === 'PGRST116') {
                  // User doesn't exist, create profile
                  console.log('User profile not found, creating new profile...')
                  try {
                    const { data: newProfile, error: createError } = await supabase
                      .from('users')
                      .insert({
                        id: session.user.id,
                        email: session.user.email,
                        full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email,
                        avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture
                      })
                      .select()
                      .single()

                    if (createError) {
                      console.error('Error creating user profile:', createError)
                    } else {
                      console.log('User profile created successfully')
                      setAuthState(prev => ({
                        ...prev,
                        userProfile: newProfile
                      }))
                    }
                  } catch (createProfileError) {
                    console.error('Error in profile creation:', createProfileError)
                  }
                } else {
                  console.error('Error fetching user profile:', profileError)
                }
              } else {
                console.log('User profile loaded successfully')
                setAuthState(prev => ({
                  ...prev,
                  userProfile: userProfile
                }))
              }
            } catch (profileError) {
              console.error('Error in async profile fetch:', profileError)
            }
          }, 100) // Small delay to ensure auth state is set first
        } else if (event === 'SIGNED_OUT') {
          console.log('SIGNED_OUT event detected')
          clearTimeout(authTimeout)
          setAuthState({
            user: null,
            userProfile: null,
            session: null,
            loading: false,
            error: null
          })
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('TOKEN_REFRESHED event detected')
          clearTimeout(authTimeout)
          setAuthState(prev => ({ ...prev, session, loading: false }))
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
      const redirectUrl = 'https://apeiron.app/auth/callback'
      
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