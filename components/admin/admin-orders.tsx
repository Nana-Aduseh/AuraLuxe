'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/currency'

interface OrderWithDetails {
  id: string
  user_id: string
  total_amount: number
  status: string
  created_at: string
  updated_at: string
  user_name?: string
  user_email?: string
  order_items?: OrderItem[]
}

interface OrderItem {
  id: string
  product_id: string
  quantity_ordered: number
  price_at_purchase: number
  product_name?: string
  color_name?: string
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items!inner (
          id,
          product_id,
          quantity_ordered,
          price_at_purchase,
          products(name),
          product_colors(color_name)
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading orders:', error)
      setLoading(false)
      return
    }

    if (data) {
      // Load user profiles for each order
      const orderIds = data.map((order: any) => order.user_id)
      const uniqueUserIds = [...new Set(orderIds)]

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', uniqueUserIds)

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

      const enrichedOrders: OrderWithDetails[] = data.map((order: any) => {
        const profile = profileMap.get(order.user_id)
        const items: OrderItem[] = (order.order_items || []).map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          quantity_ordered: item.quantity_ordered,
          price_at_purchase: item.price_at_purchase,
          product_name: Array.isArray(item.products) ? item.products[0]?.name : item.products?.name,
          color_name: Array.isArray(item.product_colors) ? item.product_colors[0]?.color_name : item.product_colors?.color_name,
        }))

        return {
          ...order,
          user_name: profile?.name || 'Unknown',
          user_email: profile?.email || 'Unknown',
          order_items: items,
        }
      })

      setOrders(enrichedOrders)
    }
    setLoading(false)
  }

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)

    if (!error) {
      loadOrders()
    } else {
      alert('Error updating order status')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-8">Orders</h2>

      {orders.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No orders yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              <div className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                   onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {order.user_name}
                      </p>
                      <p className="text-sm text-gray-600">{order.user_email}</p>
                    </div>
                    <div className="hidden md:block">
                      <p className="text-sm text-gray-600">
                        Order: {order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-amber-600">
                      {formatPrice(order.total_amount)}
                    </p>
                    <select
                      value={order.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        handleStatusUpdate(order.id, e.target.value)
                      }
                      className={`text-sm px-2 py-1 rounded border ${
                        order.status === 'completed'
                          ? 'bg-green-100 border-green-300 text-green-700'
                          : order.status === 'processing'
                            ? 'bg-blue-100 border-blue-300 text-blue-700'
                            : 'bg-yellow-100 border-yellow-300 text-yellow-700'
                      }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <span className="text-gray-400">
                    {expandedOrder === order.id ? '▼' : '▶'}
                  </span>
                </div>
              </div>

              {expandedOrder === order.id && (
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                  <h4 className="font-semibold text-gray-900 mb-3">Order Items</h4>
                  <div className="space-y-2">
                    {order.order_items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-sm text-gray-600"
                      >
                        <span>
                          {item.product_name} ({item.color_name})
                        </span>
                        <span>
                          {item.quantity_ordered}x {formatPrice(item.price_at_purchase)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
