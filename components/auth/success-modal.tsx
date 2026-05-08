'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SuccessModalProps {
  isOpen: boolean
  name: string
}

export function SuccessModal({ isOpen, name }: SuccessModalProps) {
  const router = useRouter()
  const [timeLeft, setTimeLeft] = useState(3)

  useEffect(() => {
    if (!isOpen) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          router.push('/')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen, router])

  return (
    <Dialog open={isOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Welcome to Aura Luxe! ✨</DialogTitle>
          <DialogDescription className="text-center pt-4">
            <div className="space-y-4">
              <p className="text-base font-semibold text-foreground">
                Account created successfully, {name}!
              </p>
              <p className="text-sm">
                You're all set to start shopping premium hair extensions.
              </p>
              <p className="text-xs text-muted-foreground">
                Redirecting to homepage in {timeLeft} seconds...
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
