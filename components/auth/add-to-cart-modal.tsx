'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Check } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface AddToCartSuccessModalProps {
  isOpen: boolean
  productName: string
  productImage?: string
  quantity: number
  onClose: () => void
}

export function AddToCartSuccessModal({
  isOpen,
  productName,
  productImage,
  quantity,
  onClose,
}: AddToCartSuccessModalProps) {
  const [timeLeft, setTimeLeft] = useState(4)

  useEffect(() => {
    if (!isOpen) return
    
    setTimeLeft(4)

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen])

  useEffect(() => {
    if (isOpen && timeLeft === 0) {
      onClose()
    }
  }, [timeLeft, isOpen, onClose])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute -inset-2 bg-amber-100 rounded-full blur-sm" />
              <Check className="w-12 h-12 text-amber-600 relative" />
            </div>
          </div>
          <DialogTitle className="text-center">Added to Cart! ✨</DialogTitle>
          <DialogDescription className="text-center pt-4" asChild>
            <div className="space-y-4">
              {productImage && (
                <div className="relative w-24 h-24 mx-auto rounded-lg overflow-hidden bg-muted border border-border/30">
                  <Image
                    src={productImage}
                    alt={productName}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
              )}
              <div>
                <p className="text-sm text-foreground/70 mb-1">
                  {quantity > 1 ? `${quantity} items of` : '1 item of'}
                </p>
                <p className="text-base font-semibold text-foreground line-clamp-2">
                  {productName}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-closing in {timeLeft} seconds...
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-6">
          <Button
            asChild
            className="w-full bg-amber-600 hover:bg-amber-700"
          >
            <Link href="/cart">View Cart</Link>
          </Button>
          <Button
            variant="outline"
            className="w-full"
          onClick={onClose}
          >
          Continue Shopping
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
