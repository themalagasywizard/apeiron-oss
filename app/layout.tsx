import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'T3 Chat',
  description: 'AI Chat Application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Immediate redirect for localhost auth flows
              if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
                const url = window.location.href;
                const hasAuthParams = url.includes('?code=') || 
                                     url.includes('?error=') || 
                                     url.includes('?state=') ||
                                     url.includes('#access_token=');
                
                if (hasAuthParams) {
                  const redirectUrl = url.replace('http://localhost:3000', 'https://t3-oss.netlify.app');
                  console.log('IMMEDIATE REDIRECT to production:', redirectUrl);
                  window.location.replace(redirectUrl);
                }
              }
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
