'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/currency'
import { CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function OrderConfirmationPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
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
        products(*),
        product_colors(*),
        product_quantities(*)
      `
        )
        .eq('order_id', orderId)

      if (itemsData) {
        setOrderItems(itemsData)
      }

      setLoading(false)
    }

    loadOrder()
  }, [orderId])

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
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Success Message */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            Your order has been confirmed
          </h1>
          
          <div className="space-y-3 text-left max-w-md mx-auto mb-8 bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <span className="text-green-600 font-bold mt-1">✓</span>
              <p className="text-gray-700">Your hair extensions will be shipped within 2-3 business days</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-600 font-bold mt-1">✓</span>
              <p className="text-gray-700">You'll receive tracking information via an agent</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-600 font-bold mt-1">✓</span>
              <p className="text-gray-700">An agent would reach out to you soon</p>
            </div>
          </div>
        </div>

        {/* Order Details Card */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 mb-8">
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-sm text-gray-600 mb-1">Order Number</p>
              <p className="text-lg font-semibold text-gray-900">{order.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Order Date</p>
              <p className="text-lg font-semibold text-gray-900">
                {new Date(order.created_at).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <p className="text-lg font-semibold text-green-600 capitalize">
                {order.status}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Amount</p>
              <p className="text-lg font-semibold text-amber-600">
                {formatPrice(order.total_amount)}
              </p>
            </div>
          </div>

          {/* Items */}
          <div className="border-t border-gray-200 pt-6">
            <h2 className="font-semibold text-gray-900 mb-4">Order Items</h2>
            <div className="space-y-4">
              {orderItems.map((item) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.products?.name}
                    </p>
                    <div className="text-sm text-gray-600 mt-1">
                      <p>Color: {item.product_colors?.color_name}</p>
                      <p>Length: {item.product_quantities?.length_inches}"</p>
                      <p>Quantity: {item.quantity}</p>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="font-semibold text-blue-900 mb-3">What&apos;s Next?</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>✓ Your order has been confirmed</li>
            <li>✓ A confirmation email has been sent to your inbox</li>
            <li>✓ Your hair extensions will be shipped within 2-3 business days</li>
            <li>✓ You&apos;ll receive tracking information via email</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            asChild
            className="bg-amber-600 hover:bg-amber-700 text-white py-3"
          >
            <Link href="/">Continue Shopping</Link>
          </Button>
          <Button
            variant="outline"
            asChild
            className="py-3"
          >
            <Link href="/">Back to Home</Link>
          </Button>
        </div>

        {/* Contact Info */}
        <div className="text-center mt-12 pt-8 border-t border-gray-200">
          <p className="text-gray-600 text-sm">
            Have questions? Contact us at{' '}
            <a
              href="mailto:support@auraluxe.com"
              className="text-amber-600 hover:text-amber-700"
            >
              support@auraluxe.com
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}
