"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { Chrome, Loader2 } from 'lucide-react'

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const { signInWithGoogle, loading, error } = useAuth()
  const [isSigningIn, setIsSigningIn] = useState(false)

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true)
    try {
      await signInWithGoogle()
      // Note: The user will be redirected to Google, so we don't need to close the modal here
    } catch (error) {
      console.error('Sign in error:', error)
      setIsSigningIn(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-gray-900 dark:text-white">Welcome to Apeiron</DialogTitle>
          <DialogDescription className="text-center text-gray-600 dark:text-gray-400">
            Sign in to save your conversations and access them across devices
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col space-y-4">
          <Button
            onClick={handleGoogleSignIn}
            disabled={loading || isSigningIn}
            className="w-full h-12 text-base font-medium bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
            variant="outline"
          >
            {isSigningIn ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Chrome className="w-5 h-5 mr-2" />
            )}
            Continue with Google
          </Button>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="text-xs text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            By signing in, you agree to our Terms of Service and Privacy Policy.
            Your API keys remain stored locally on your device.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 