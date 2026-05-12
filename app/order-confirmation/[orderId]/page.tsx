'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/currency'
import { CheckCircle, Printer, Mail } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function OrderConfirmationPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [emailSent, setEmailSent] = useState(false)
  const supabase = createClient()

  const orderId = params.orderId as string

  useEffect(() => {
    const loadOrder = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('user_id', user.id)
        .single()

      if (orderError || !orderData) {
        router.push('/')
        return
      }

      setOrder(orderData)

      const { data: itemsData } = await supabase
        .from('order_items')
        .select(
          `
        *,
        products(id, name, price),
        product_colors(color_name),
        product_quantities(length_inches)
      `
        )
        .eq('order_id', orderId)

      if (itemsData) {
        setOrderItems(itemsData)
      }

      // Send confirmation email
      if (!emailSent) {
        sendConfirmationEmail(user.email, orderData, itemsData)
        setEmailSent(true)
      }

      setLoading(false)
    }

    loadOrder()
  }, [orderId])

  const sendConfirmationEmail = async (email: string | undefined, orderData: any, itemsData: any[]) => {
    if (!email) return

    try {
      const response = await fetch('/api/send-order-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          orderId: orderData.id,
          orderNumber: orderData.id.slice(0, 8).toUpperCase(),
          totalAmount: orderData.total_amount,
          items: itemsData,
          createdAt: orderData.created_at,
        }),
      })

      if (response.ok) {
        console.log('Confirmation email sent successfully')
      }
    } catch (error) {
      console.error('Error sending confirmation email:', error)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
        </div>
      </main>
    )
  }

  if (!order) {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <p className="text-gray-500">Order not found</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Actions */}
        <div className="no-print flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Button
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 text-sm flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </Button>
          <Button
            asChild
            className="bg-amber-600 hover:bg-amber-700 text-white py-2 text-sm"
          >
            <Link href="/">Continue Shopping</Link>
          </Button>
          <Button
            variant="outline"
            asChild
            className="py-2 text-sm"
          >
            <Link href="/orders">View Orders</Link>
          </Button>
        </div>

        {/* Receipt Container - Optimized for single page printing */}
        <div className="bg-white border-2 border-gray-300 p-6 space-y-4">
          {/* Header with Logo and Business Name */}
          <div className="text-center border-b-2 border-gray-300 pb-3">
            <div className="flex justify-center mb-2">
              <Image
                src="/aura-luxe-logo.png"
                alt="Aura Luxe"
                width={100}
                height={40}
                className="h-10 w-auto"
              />
            </div>
            <h1 className="text-lg font-bold text-gray-900">AURA LUXE EXTENSIONS</h1>
            <p className="text-xs text-gray-600">Premium Quality Hair Extensions</p>
          </div>

          {/* Order Header */}
          <div className="grid grid-cols-2 gap-4 text-sm border-b border-gray-300 pb-3">
            <div>
              <p className="text-gray-600 text-xs font-semibold">ORDER NUMBER</p>
              <p className="font-bold text-gray-900 text-sm">{order.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-600 text-xs font-semibold">DATE</p>
              <p className="font-bold text-gray-900 text-sm">{new Date(order.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-gray-600 text-xs font-semibold">STATUS</p>
              <p className="font-bold text-green-600 capitalize text-sm">{order.status}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-600 text-xs font-semibold">TOTAL</p>
              <p className="font-bold text-amber-600 text-sm">{formatPrice(order.total_amount)}</p>
            </div>
          </div>

          {/* Order Items */}
          <div className="text-xs">
            <p className="font-semibold text-gray-900 mb-2">ORDER ITEMS</p>
            <div className="space-y-1">
              {orderItems && orderItems.length > 0 ? (
                orderItems.map((item) => {
                  // Handle both array and object responses from Supabase relations
                  const product = Array.isArray(item.products) ? item.products[0] : item.products
                  const color = Array.isArray(item.product_colors) ? item.product_colors[0] : item.product_colors
                  const quantity_data = Array.isArray(item.product_quantities) ? item.product_quantities[0] : item.product_quantities

                  return (
                    <div key={item.id} className="flex justify-between items-start py-1 border-b border-gray-200 last:border-0">
                      <div className="flex-1 pr-2">
                        <p className="font-medium text-gray-900">{product?.name || 'Product'}</p>
                        <p className="text-gray-600">Color: {color?.color_name || 'N/A'} | Length: {quantity_data?.length_inches || 'N/A'}" | Qty: {item.quantity}</p>
                      </div>
                      <p className="font-semibold text-gray-900 whitespace-nowrap">
                        {formatPrice((product?.price || 0) * (item.quantity || 1))}
                      </p>
                    </div>
                  )
                })
              ) : (
                <p className="text-gray-500">No items found</p>
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t-2 border-gray-300 pt-2 text-sm font-bold flex justify-between">
            <span>TOTAL:</span>
            <span className="text-amber-600 text-base">{formatPrice(order.total_amount)}</span>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-600 border-t border-gray-300 pt-2">
            <p>Thank you for your purchase!</p>
            <p>Contact: +233 542 426 135 | Accra, Ghana</p>
          </div>
        </div>

        {/* Next Steps - Only on screen */}
        <div className="no-print mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <h3 className="font-semibold text-blue-900 mb-2">What's Next?</h3>
          <ul className="space-y-1 text-blue-800 text-sm">
            <li>✓ Your order has been confirmed</li>
            <li>✓ A confirmation email has been sent</li>
            <li>✓ Your hair extensions will be processed within 2-3 business days</li>
            <li>✓ You'll receive delivery updates via phone call</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
