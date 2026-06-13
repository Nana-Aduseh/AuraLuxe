'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertCircle, MessageCircle } from 'lucide-react'

interface PrePaystackModalProps {
  isOpen: boolean
  onProceed: () => void
  isLoading?: boolean
}

export function PrePaystackModal({ isOpen, onProceed, isLoading = false }: PrePaystackModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <DialogTitle className="text-center">Confirm Payment</DialogTitle>
          <DialogDescription className="text-center pt-4" asChild>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-left text-sm text-blue-900">
                    <p className="font-semibold mb-2">SMS Code Delay?</p>
                    <p className="text-xs leading-relaxed">
                      If you don't receive the verification code via SMS, wait for the timer to expire on the Paystack page and then select the WhatsApp option to receive it there instead.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-foreground/60">
                You will be redirected to Paystack's secure payment page.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 mt-6">
          <Button
            onClick={onProceed}
            disabled={isLoading}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {isLoading ? 'Processing...' : 'Proceed to Paystack'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
