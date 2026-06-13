'use client'

import { useRouter, usePathname } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ShoppingCart } from 'lucide-react'

interface AddToCartRequiresSignInModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AddToCartRequiresSignInModal({
  isOpen,
  onClose,
}: AddToCartRequiresSignInModalProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleSignIn = () => {
    router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`)
  }

  const handleSignUp = () => {
    router.push(`/auth/sign-up?returnTo=${encodeURIComponent(pathname)}`)
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
            <div className="space-y-3">
              <p className="text-base font-semibold text-foreground">
                Add to cart is only available for signed-in users
              </p>
              <p className="text-sm text-foreground/70">
                Sign in to your account or create a new one to start shopping.
              </p>
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
            Sign Up
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
