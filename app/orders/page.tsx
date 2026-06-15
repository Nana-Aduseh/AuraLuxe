'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/currency'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fetchAccessibleOrdersAfterAuth } from '@/lib/guest-orders'

interface OrderItem {
  product_id: string
  product?: {
    name: string
    length_inches?: number
    price?: number
  }
  product_name?: string
  quantity_ordered?: number
  quantity?: number
  price_at_purchase?: number
  price?: number
  color_name?: string
  color?: { color_name: string }
  length_inches?: number
}

interface Order {
  id: string
  order_number: string
  created_at: string
  total_amount: number
  status: string
  confirmation_status: string
  delivery_status: string | null
  order_type: string
  items?: OrderItem[]
  order_items?: OrderItem[] // Handle Supabase default join naming
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string>('')
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
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
        let allOrders = (ordersData as Order[]) || []

        // --- RECOVERY LOGIC FOR "NOT PLACED" ORDERS ---
        // Check local storage for any order IDs/References the browser remembers
        const guestOrdersJson = typeof window !== 'undefined' ? window.localStorage.getItem('aura-luxe-guest-orders') : null;
        const localOrderIds: string[] = [];
        
        if (guestOrdersJson) {
          try {
            const parsed = JSON.parse(guestOrdersJson);
            if (Array.isArray(parsed)) {
              parsed.forEach(item => { if (item.orderId) localOrderIds.push(item.orderId); });
            }
          } catch (e) { /* ignore */ }
        }

        // Check for a pending reference from a recent checkout attempt
        const pendingRef = typeof window !== 'undefined' ? window.sessionStorage.getItem('aura-luxe-pending-payment-reference') : null;
        if (pendingRef) localOrderIds.push(pendingRef);

        // Find IDs that are NOT in the database results
        const missingIds = [...new Set(localOrderIds)].filter(id => 
          !allOrders.some(o => o.id === id || o.payment_reference === id)
        );

        if (missingIds.length > 0) {
          const recovered = await Promise.all(
            missingIds.map(async (id) => {
              try {
                const gToken = typeof window !== 'undefined' ? (window.sessionStorage.getItem('aura-luxe-guest-order-token') || window.sessionStorage.getItem('aura-luxe-pending-payment-token')) : null;
                const tokenQuery = gToken ? `?token=${encodeURIComponent(gToken)}` : "";
                const res = await fetch(`/api/orders/by-reference/${encodeURIComponent(id)}${tokenQuery}`);
                if (res.ok) {
                  const data = await res.json();
                  if (data.verified || data.order) {
                    // If verified but not in DB, trigger finalize to sync it for the admin
                    if (data.verified && !data.order) {
                      await fetch("/api/orders/finalize", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reference: id, token: gToken }),
                      }).catch(err => console.error("Auto-recovery finalize failed:", err));
                    }

                    return data.order || {
                      id: data.payData?.reference || id,
                      order_number: "RECOVERED",
                      created_at: data.payData?.created_at || new Date().toISOString(),
                      total_amount: data.payData?.amount ? data.payData.amount / 100 : 0,
                      status: 'processing',
                      confirmation_status: 'not_confirmed',
                      items: data.items || []
                    };
                  }
                }
              } catch (e) { return null; }
              return null;
            })
          );
          const validRecovered = recovered.filter(o => o !== null) as Order[];
          allOrders = [...validRecovered, ...allOrders];
        }
        // ----------------------------------------------

        if (allOrders.length > 0) {
          // Fetch items for each order
          const ordersWithItems = await Promise.all(
            allOrders.map(async (order: any) => {
              // If items are already present (e.g. from a Supabase join), use them
              const existingItems = order.items || order.order_items;
              if (existingItems && existingItems.length > 0) {
                return { ...order, items: existingItems };
              }

              try {
                const gToken = typeof window !== 'undefined' ? window.sessionStorage.getItem('aura-luxe-guest-order-token') : null;
                const tokenQuery = gToken ? `?token=${encodeURIComponent(gToken)}` : "";
                
                const response = await fetch(
                  `/api/orders/by-reference/${encodeURIComponent(order.id)}${tokenQuery}`,
                  { cache: 'no-store' },
                )

                if (response.ok) {
                  const payload = await response.json()
                  return {
                    ...order,
                    items: Array.isArray(payload.items) ? payload.items : [],
                  }
                }
              } catch (error) {
                console.error(`Failed to load items for order ${order.id}:`, error)
              }
              return { ...order, items: [] }
            }),
          )
          setOrders(ordersWithItems)
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
      return 'Payment Verified - Awaiting Admin Confirmation'
    }
    if (deliveryStatus === 'received') {
      return 'Completed'
    }
    if (deliveryStatus === 'sent') {
      return 'In Transit'
    }
    if (confirmationStatus === 'confirmed' && !deliveryStatus) {
      return 'Processing'
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
          <div className="space-y-2">
            {orders.map((order) => (
              <div key={order.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Collapsible Header */}
                <button
                  onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                  className="w-full hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between p-4 sm:p-6">
                    {/* Left side: Order details */}
                    <div className="flex-1 text-left">
                      <div className="flex flex-col gap-3">
                        {/* Order Number and Date */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <p className="text-sm text-gray-600">Order Number</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {order.order_number || order.id.slice(0, 8).toUpperCase()}
                            </p>
                          </div>
                          <div className="text-right sm:text-left">
                            <p className="text-sm text-gray-600">Order Date</p>
                            <p className="text-lg font-semibold text-gray-900">
                              {new Date(order.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        {/* Order Items Summary */}
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Items</p>
                          <div className="flex flex-wrap gap-2">
                            {order.items && order.items.length > 0 ? (
                              order.items.map((item, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block bg-amber-50 text-amber-900 text-sm px-3 py-1 rounded-full"
                                >
                                  {item.product?.name || item.product_name || 'Item'} ×{item.quantity_ordered ?? item.quantity ?? 0}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-gray-500">No items</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right side: Chevron and status icon */}
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-2xl">
                        {getStatusIcon(order.confirmation_status, order.delivery_status)}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 text-gray-600 transition-transform ${
                          expandedOrderId === order.id ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {expandedOrderId === order.id && (
                  <div className="border-t border-gray-200 bg-white p-4 sm:p-6 space-y-4">
                    {/* Status Bar */}
                    <div className="flex items-center gap-2 mb-4 py-3 px-4 bg-gray-50 rounded-lg">
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

                    {/* Receipt - Order Items */}
                    {order.items && order.items.length > 0 && (
                      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Order Receipt</h3>
                        <div className="space-y-3 mb-3 border-b border-gray-200 pb-3">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="text-sm">
                              <p className="font-medium text-gray-900">
                                {item.product?.name || item.product_name || 'Unknown Product'}
                              </p>
                              <div className="mt-2 text-xs text-gray-600 space-y-1">
                                {(item.color?.color_name || item.color_name) && (item.color?.color_name || item.color_name) !== 'Default' && (
                                  <p>Color: {item.color?.color_name || item.color_name}</p>
                                )}
                                {(item.product?.length_inches || item.length_inches) && (
                                  <p>Length: {item.product?.length_inches || item.length_inches}"</p>
                                )}
                                {(item.quantity_ordered ?? item.quantity) && (
                                  <p>Quantity: {item.quantity_ordered ?? item.quantity}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between font-semibold text-gray-900">
                          <p>Total:</p>
                          <p className="text-amber-600">{formatPrice(order.total_amount)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
