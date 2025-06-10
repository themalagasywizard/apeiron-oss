import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Auth callback error:', error)
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error.message)}`)
      }
    } catch (error) {
      console.error('Unexpected auth error:', error)
      return NextResponse.redirect(`${origin}/auth/error?message=Authentication failed`)
    }
  }

  // Determine the redirect URL - use production URL for deployed app
  const isProduction = new URL(request.url).hostname !== 'localhost'
  const redirectUrl = isProduction ? 'https://t3-oss.netlify.app/' : origin
  
  // Redirect to home page after successful authentication
  return NextResponse.redirect(redirectUrl)
} 