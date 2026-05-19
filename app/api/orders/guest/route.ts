import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const body = await request.json().catch(() => null)
  const cartItems = Array.isArray(body?.cartItems) ? body.cartItems : []
  const guestInfo = body?.guestInfo || null
  const totalAmount = Number(body?.totalAmount || 0)
  const deliveryType = body?.deliveryType === 'pickup' ? 'pickup' : 'delivery'

  if (!guestInfo) {
    return NextResponse.json({ error: 'Guest information is required' }, { status: 400 })
  }

  const { data, error: orderError } = await supabase.rpc('create_guest_order', {
    p_cart_items: cartItems,
    p_total_amount: totalAmount,
    p_delivery_type: deliveryType,
    p_guest_info: guestInfo,
  })

  if (orderError || !data?.order) {
    return NextResponse.json(
      { error: orderError?.message || 'Unable to create guest order' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ...data.order,
    guest_access_token: data.order.guest_access_token,
  })
}
