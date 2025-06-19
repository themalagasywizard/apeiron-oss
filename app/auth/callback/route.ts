import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  
  // If there's an error, redirect to error page
  if (error) {
    console.error('OAuth error:', error)
    return NextResponse.redirect(`https://apeiron-oss.netlify.app/auth/error?message=${encodeURIComponent(error)}`)
  }
  
  // For PKCE flow, let the client-side handle the code exchange
  // Just redirect to production with the code parameter intact
  if (code) {
    return NextResponse.redirect(`https://apeiron-oss.netlify.app/?code=${code}`)
  }

  // Fallback redirect to production
  return NextResponse.redirect('https://apeiron-oss.netlify.app/')
} 