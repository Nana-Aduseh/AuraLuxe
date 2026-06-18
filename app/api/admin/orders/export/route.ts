import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Prevent Next.js from caching this route so it always fetches fresh data
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase admin client missing' }, { status: 500 })
    }

    let query = supabase.from('orders').select('*').order('completed_at', { ascending: false })

    // If a start date is provided, filter from the beginning of that day
    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      query = query.gte('completed_at', start.toISOString())
    }

    // If an end date is provided, filter to the very end of that day
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      query = query.lte('completed_at', end.toISOString())
    }

    const { data: orders, error: ordersError } = await query
    if (ordersError) throw ordersError

    // Fetch user profiles to attach to orders
    const userIds = Array.from(new Set(orders.map((o: any) => o.user_id).filter(Boolean)))
    let profilesMap = new Map()
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, name, email').in('id', userIds)
      if (profiles) profilesMap = new Map(profiles.map(p => [p.id, p]))
    }

    // Fetch related order_items, products, and colors
    const orderIds = orders.map((o: any) => o.id)
    let itemsMap = new Map()
    
    if (orderIds.length > 0) {
      const { data: orderItemsData } = await supabase.from('order_items').select('*').in('order_id', orderIds)

      if (orderItemsData) {
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
          const prodName = productsMap.get(item.product_id) || `Product ID: ${item.product_id}`
          const colorName = item.color_id ? colorsMap.get(item.color_id) : null
          const colorStr = colorName ? ` (${colorName})` : ''
          
          const formattedItem = `${item.quantity_ordered}x ${prodName}${colorStr}`
          
          if (!itemsMap.has(item.order_id)) {
            itemsMap.set(item.order_id, [])
          }
          itemsMap.get(item.order_id).push(formattedItem)
        }
      }
    }

    // Define exactly matching CSV headers
    const headers = ['amount_paid', 'customer_name', 'customer_email', 'payment_reference', 'paid_at', 'phone_number', 'order_items', 'location']
    const csvRows = [headers.join(',')]

    const escapeCsv = (str: string | number | null | undefined) => {
      if (str === null || str === undefined) return '""'
      const s = String(str).replace(/"/g, '""') // duplicate internal quotes for escaping
      return `"${s}"` // Wrap string in quotes
    }

    for (const order of orders) {
      const profile = order.user_id ? profilesMap.get(order.user_id) : null;
      
      const guestFullName = [order.guest_first_name, order.guest_last_name].filter(Boolean).join(" ").trim();
      const customerName = profile?.name || guestFullName || "";
      const customerEmail = profile?.email || order.guest_email || "";
      const location = [order.guest_address, order.guest_town, order.guest_region].filter(Boolean).join(", ");
      const itemsText = (itemsMap.get(order.id) || []).join(", ");

      csvRows.push([
        escapeCsv(order.total_amount), escapeCsv(customerName), escapeCsv(customerEmail), escapeCsv(order.payment_reference),
        escapeCsv(order.completed_at), escapeCsv(order.guest_phone), escapeCsv(itemsText), escapeCsv(location)
      ].join(','))
    }

    return new NextResponse(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="orders-export-${startDate || 'all'}-to-${endDate || 'all'}.csv"`
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
