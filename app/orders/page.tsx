'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/currency'
import { ArrowLeft, Eye } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fetchAccessibleOrdersAfterAuth } from '@/lib/guest-orders'

interface Order {
  id: string
  order_number: string
  created_at: string
  total_amount: number
  status: string
  confirmation_status: string
  delivery_status: string | null
  order_type: string
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    const loadOrders = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      setUserEmail(user.email || '')

      try {
        const ordersData = await fetchAccessibleOrdersAfterAuth()

        if (ordersData) {
          setOrders(ordersData.filter((order: Order) => order.confirmation_status === 'confirmed') as Order[])
        }
      } catch (ordersError) {
        console.error('Failed to load accessible orders:', ordersError)
      }

      setLoading(false)
    }

    loadOrders()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'received':
        return 'text-green-600 bg-green-50'
      case 'pending':
      case 'not_confirmed':
        return 'text-yellow-600 bg-yellow-50'
      case 'confirmed':
      case 'sent':
        return 'text-blue-600 bg-blue-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getDeliveryStatusDisplay = (confirmationStatus: string, deliveryStatus: string | null) => {
    if (confirmationStatus === 'not_confirmed') {
      return 'Pending Confirmation'
    }
    if (confirmationStatus === 'confirmed' && !deliveryStatus) {
      return 'Confirmed'
    }
    if (deliveryStatus === 'sent') {
      return 'In Transit'
    }
    if (deliveryStatus === 'received') {
      return 'Delivered'
    }
    return 'Processing'
  }

  const getStatusIcon = (confirmationStatus: string, deliveryStatus: string | null) => {
    if (confirmationStatus === 'not_confirmed') {
      return '⏳'
    }
    if (confirmationStatus === 'confirmed' && !deliveryStatus) {
      return '✓'
    }
    if (deliveryStatus === 'sent') {
      return '📦'
    }
    if (deliveryStatus === 'received') {
      return '✓'
    }
    return '•'
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

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Your Orders</h1>
              <p className="text-gray-600 mt-1">{userEmail}</p>
            </div>
          </div>
          <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white">
            <Link href="/extensions">Continue Shopping</Link>
          </Button>
        </div>

        {/* Orders List */}
        {orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                {/* Order Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Order Number</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {order.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 mb-1">Order Date</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Status Bar */}
                <div className="flex items-center gap-2 mb-4 py-3 px-4 bg-gray-50 rounded-lg">
                  <span className="text-2xl">
                    {getStatusIcon(order.confirmation_status, order.delivery_status)}
                  </span>
                  <div>
                    <p className={`font-semibold ${getStatusColor(order.confirmation_status)}`}>
                      {getDeliveryStatusDisplay(order.confirmation_status, order.delivery_status)}
                    </p>
                  </div>
                  <div className="ml-auto">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      order.order_type === 'delivery'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {order.order_type === 'delivery' ? '🚚 Delivery' : '📍 Pickup'}
                    </span>
                  </div>
                </div>

                {/* Progress Timeline */}
                <div className="mb-4 py-3 px-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs font-semibold text-blue-900 mb-3">ORDER PROGRESS</p>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        order.status === 'pending' || order.confirmation_status || order.delivery_status
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}>
                        ✓
                      </div>
                      <p className="mt-1 text-gray-700 font-medium">Placed</p>
                    </div>
                    <div className={`flex-1 h-0.5 ${
                      order.confirmation_status !== 'not_confirmed' ? 'bg-green-500' : 'bg-gray-300'
                    }`}></div>
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        order.confirmation_status === 'confirmed'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}>
                        ✓
                      </div>
                      <p className="mt-1 text-gray-700 font-medium">Confirmed</p>
                    </div>
                    <div className={`flex-1 h-0.5 ${
                      order.delivery_status === 'sent' || order.delivery_status === 'received'
                        ? 'bg-green-500'
                        : 'bg-gray-300'
                    }`}></div>
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        order.delivery_status === 'received'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}>
                        ✓
                      </div>
                      <p className="mt-1 text-gray-700 font-medium">Delivered</p>
                    </div>
                  </div>
                </div>

                {/* Order Details */}
                <div className="grid grid-cols-3 gap-4 py-3 px-4 bg-gray-50 rounded-lg mb-4">
                  <div>
                    <p className="text-xs text-gray-600 font-semibold mb-1">STATUS</p>
                    <p className="font-medium text-gray-900 capitalize">{order.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold mb-1">CONFIRMATION</p>
                    <p className="font-medium text-gray-900 capitalize">
                      {order.confirmation_status?.replace('_', ' ') || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold mb-1">TOTAL AMOUNT</p>
                    <p className="font-bold text-amber-600">{formatPrice(order.total_amount)}</p>
                  </div>
                </div>

                {/* Action Button */}
                <Button asChild className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                  <Link href={`/order-confirmation/${order.id}`} className="flex items-center justify-center gap-2">
                    <Eye className="w-4 h-4" />
                    View Order Details
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-600 mb-6">You haven't placed any orders yet.</p>
            <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white">
              <Link href="/extensions">Start Shopping</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
