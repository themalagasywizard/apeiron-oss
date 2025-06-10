// Environment variables validation utility
export function validateSupabaseEnvVars() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const missing = []
  
  if (!supabaseUrl) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL')
  }
  
  if (!supabaseAnonKey) {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  if (missing.length > 0) {
    const errorMessage = `
Missing required Supabase environment variables: ${missing.join(', ')}

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
    `.trim()

    throw new Error(errorMessage)
  }

  return {
    supabaseUrl: supabaseUrl as string,
    supabaseAnonKey: supabaseAnonKey as string
  }
}

// Development helper to check if we're in a development environment
export function isDevelopment() {
  return process.env.NODE_ENV === 'development'
}

// Helper to log environment status in development
export function logEnvStatus() {
  if (isDevelopment()) {
    console.log('🔧 Environment Check:')
    console.log(`- NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}`)
    console.log(`- NEXT_PUBLIC_SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`)
    console.log(`- NODE_ENV: ${process.env.NODE_ENV}`)
  }
} 