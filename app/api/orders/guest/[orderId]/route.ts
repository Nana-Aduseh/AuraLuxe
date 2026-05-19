import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ orderId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const supabase = await createClient()

  const { orderId } = await params
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const { data, error: orderError } = await supabase.rpc('get_guest_order', {
    p_order_id: orderId,
    p_token: token,
  })

  if (orderError || !data?.order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({ order: data.order, items: data.items || [] })
}
