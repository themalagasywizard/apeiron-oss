import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'
import { logEnvStatus } from './env-check'

// Get environment variables with fallbacks for build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Only validate in runtime, not during build
function validateSupabaseConfig() {
  if (typeof window !== 'undefined' || process.env.NODE_ENV === 'development') {
    const missing = []
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      missing.push('NEXT_PUBLIC_SUPABASE_URL')
    }
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }

    if (missing.length > 0) {
      console.warn(`
⚠️  Missing Supabase environment variables: ${missing.join(', ')}

For local development:
1. Create a .env.local file in your project root
2. Add the following variables:
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

For Netlify deployment:
1. Go to your Netlify project dashboard
2. Navigate to Site settings > Environment variables
3. Add the same variables there

Get these values from your Supabase project settings at https://supabase.com
      `.trim())
    }
  }
}

// Validate configuration
validateSupabaseConfig()

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