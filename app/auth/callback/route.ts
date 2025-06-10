import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    try {
      // Create a server-side supabase client for the code exchange
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            flowType: 'pkce'
          }
        }
      )
      
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Auth callback error:', error)
        return NextResponse.redirect(`https://t3-oss.netlify.app/auth/error?message=${encodeURIComponent(error.message)}`)
      }
    } catch (error) {
      console.error('Unexpected auth error:', error)
      return NextResponse.redirect(`https://t3-oss.netlify.app/auth/error?message=Authentication failed`)
    }
  }

  // Always redirect to production URL after successful authentication
  return NextResponse.redirect('https://t3-oss.netlify.app/')
} 