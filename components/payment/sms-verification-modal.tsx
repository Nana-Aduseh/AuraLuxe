'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MessageCircle, Phone, RotateCcw, Loader2, AlertCircle } from 'lucide-react'
import { AlertCircleIcon } from 'lucide-react'

interface SMSVerificationModalProps {
  isOpen: boolean
  phoneNumber: string
  onVerifyCode: (code: string) => Promise<void>
  onResendCode: (method: 'sms' | 'whatsapp') => Promise<void>
  onClose: () => void
  isLoading?: boolean
}

export function SMSVerificationModal({
  isOpen,
  phoneNumber,
  onVerifyCode,
  onResendCode,
  onClose,
  isLoading = false,
}: SMSVerificationModalProps) {
  const [verificationCode, setVerificationCode] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificationMethod, setVerificationMethod] = useState<'sms' | 'whatsapp'>('sms')
  const [resendTimer, setResendTimer] = useState(0)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Countdown timer for resend button
  useEffect(() => {
    if (resendTimer <= 0) return

    const timer = setInterval(() => {
      setResendTimer((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [resendTimer])

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (verificationCode.length < 4) {
      setError('Please enter a valid verification code')
      return
    }

    setVerifyLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      await onVerifyCode(verificationCode)
      setSuccessMessage('Code verified successfully! ✓')
      setTimeout(() => {
        setVerificationCode('')
        onClose()
      }, 1500)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to verify code. Please try again.'
      )
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleResendCode = async (method: 'sms' | 'whatsapp') => {
    setResendLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      await onResendCode(method)
      setVerificationMethod(method)
      setSuccessMessage(
        `Code sent via ${method === 'sms' ? 'SMS' : 'WhatsApp'}! Check your messages.`
      )
      setResendTimer(60) // 60 second cooldown
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to resend via ${method}. Please try again.`
      )
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute -inset-2 bg-amber-100 rounded-full blur-sm" />
              <Phone className="w-12 h-12 text-amber-600 relative" />
            </div>
          </div>
          <DialogTitle className="text-center">Verify Your Payment</DialogTitle>
          <DialogDescription className="text-center pt-4" asChild>
            <div className="space-y-2">
              <p className="text-foreground font-medium">
                A verification code has been sent to:
              </p>
              <p className="text-sm text-foreground/70 font-semibold">{phoneNumber}</p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          {/* Error Message */}
          {error && (
            <div className="flex gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="flex gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5 text-center">✓</div>
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
          )}

          {/* Verification Code Input */}
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <Label htmlFor="code" className="block text-sm font-semibold mb-2">
                Enter Verification Code
              </Label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setVerificationCode(cleaned)
                  setError(null)
                }}
                maxLength={6}
                className="text-center text-2xl tracking-widest font-semibold"
                disabled={verifyLoading || isLoading}
                autoFocus
              />
              <p className="text-xs text-foreground/60 mt-1">
                Enter the {verificationMethod === 'sms' ? '6-digit code sent via SMS' : '6-digit code sent via WhatsApp'}
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700"
              disabled={verifyLoading || verificationCode.length < 4 || isLoading}
            >
              {verifyLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Code'
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-border/20" />
            <span className="text-xs text-foreground/50">OR</span>
            <div className="flex-1 border-t border-border/20" />
          </div>

          {/* Resend Options */}
          <div className="space-y-2">
            <p className="text-xs text-foreground/70 font-medium">Didn't receive the code?</p>
            
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => handleResendCode('sms')}
                variant={verificationMethod === 'sms' ? 'default' : 'outline'}
                size="sm"
                disabled={resendLoading || resendTimer > 0 || isLoading}
                className={verificationMethod === 'sms' ? 'bg-amber-600 hover:bg-amber-700' : ''}
              >
                {resendLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <Phone className="w-3 h-3 mr-1" />
                    {resendTimer > 0 ? `Resend (${resendTimer}s)` : 'Resend SMS'}
                  </>
                )}
              </Button>

              <Button
                onClick={() => handleResendCode('whatsapp')}
                variant={verificationMethod === 'whatsapp' ? 'default' : 'outline'}
                size="sm"
                disabled={resendLoading || resendTimer > 0 || isLoading}
                className={verificationMethod === 'whatsapp' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {resendLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <MessageCircle className="w-3 h-3 mr-1" />
                    WhatsApp
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Info Message */}
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-700">
              ℹ️ The verification code will expire in 10 minutes. If it expires, request a new one.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
