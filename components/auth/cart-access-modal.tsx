'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ShoppingCart } from 'lucide-react'

interface CartAccessModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CartAccessModal({ isOpen, onClose }: CartAccessModalProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  // Get the current page path to redirect back after sign in
  const returnTo = searchParams?.get('returnTo') || '/cart'

  const handleSignIn = () => {
    router.push(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`)
  }

  const handleSignUp = () => {
    router.push(`/auth/sign-up?returnTo=${encodeURIComponent(returnTo)}`)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <ShoppingCart className="w-12 h-12 text-amber-600" />
          </div>
          <DialogTitle className="text-center">Sign In Required</DialogTitle>
          <DialogDescription className="text-center pt-4" asChild>
            <div className="space-y-4">
              <div className="text-base font-semibold text-foreground">
                Access your cart
              </div>
              <div className="text-sm text-foreground/70">
                Please sign in or create an account to view and manage your cart.
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-6">
          <Button
            onClick={handleSignIn}
            className="w-full bg-amber-600 hover:bg-amber-700"
          >
            Sign In
          </Button>
          <Button
            onClick={handleSignUp}
            variant="outline"
            className="w-full"
          >
            Create Account
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
