import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Prevent Next.js from caching this route so it always fetches fresh data
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase admin client missing' }, { status: 500 })
    }

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (ordersError) throw ordersError
    
    // Fetch user profiles for the orders
    const userIds = Array.from(new Set(orders.map((o: any) => o.user_id).filter(Boolean)))
    let profilesMap = new Map()
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds)
        
      if (profiles) {
        profilesMap = new Map(profiles.map(p => [p.id, p]))
      }
    }

    // Fetch order items
    const orderIds = orders.map((o: any) => o.id)
    let itemsMap = new Map()
    
    if (orderIds.length > 0) {
      const { data: orderItemsData } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds)

      if (orderItemsData) {
        // Fetch products and colors to enrich the items
        const productIds = Array.from(new Set(orderItemsData.map((i: any) => i.product_id).filter(Boolean)))
        const colorIds = Array.from(new Set(orderItemsData.map((i: any) => i.color_id).filter(Boolean)))
        
        let productsMap = new Map()
        if (productIds.length > 0) {
           const { data: products } = await supabase.from('products').select('id, name').in('id', productIds)
           if (products) productsMap = new Map(products.map(p => [p.id, p.name]))
        }
        
        let colorsMap = new Map()
        if (colorIds.length > 0) {
           const { data: colors } = await supabase.from('product_colors').select('id, color_name').in('id', colorIds)
           if (colors) colorsMap = new Map(colors.map(c => [c.id, c.color_name]))
        }

        for (const item of orderItemsData) {
          const formattedItem = {
            id: item.id,
            product_id: item.product_id,
            quantity_ordered: item.quantity_ordered,
            price_at_purchase: item.price_at_purchase,
            product_name: productsMap.get(item.product_id) || `Product ID: ${item.product_id}`,
            color_name: item.color_id ? colorsMap.get(item.color_id) : '',
          }
          
          if (!itemsMap.has(item.order_id)) {
            itemsMap.set(item.order_id, [])
          }
          itemsMap.get(item.order_id).push(formattedItem)
        }
      }
    }

    const formattedOrders = orders.map((order: any) => {
      const profile = order.user_id ? profilesMap.get(order.user_id) : null;
      const guestFullName = [order.guest_first_name, order.guest_last_name].filter(Boolean).join(" ").trim();

      return {
        ...order,
        user_name: profile?.name || guestFullName || "Guest Checkout",
        user_email: profile?.email || order.guest_email || "No Email",
        order_items: itemsMap.get(order.id) || [],
        guest_phone: order.guest_phone || null,
        guest_address: order.guest_address || null,
        guest_town: order.guest_town || null,
        guest_region: order.guest_region || null,
      }
    })

    return NextResponse.json({ orders: formattedOrders })
  } catch (err: any) {
    console.error('Error fetching admin orders:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}