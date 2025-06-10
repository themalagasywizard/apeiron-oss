import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'
import { validateSupabaseEnvVars, logEnvStatus } from './env-check'

// Validate and get environment variables
const { supabaseUrl, supabaseAnonKey } = validateSupabaseEnvVars()

// Log environment status in development
logEnvStatus()

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Auth helpers
export const auth = supabase.auth

// Database helpers
export const db = supabase.from

// Storage helpers  
export const storage = supabase.storage 