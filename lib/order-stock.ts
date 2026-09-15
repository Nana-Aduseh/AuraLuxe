import type { SupabaseClient } from '@supabase/supabase-js'

interface StockOrderItem {
  product_id?: string | null
  color_id?: string | null
  quantity_ordered?: number | null
}

async function decrementStock(
  supabase: SupabaseClient,
  table: 'product_colors',
  id: string,
  quantity: number,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error: readError } = await supabase
      .from(table)
      .select('stock_quantity')
      .eq('id', id)
      .maybeSingle()

    if (readError) throw readError
    if (!data || typeof data.stock_quantity !== 'number') return

    const { data: updatedRows, error: updateError } = await supabase
      .from(table)
      .update({ stock_quantity: Math.max(0, data.stock_quantity - quantity) })
      .eq('id', id)
      .eq('stock_quantity', data.stock_quantity)
      .select('id')

    if (updateError) throw updateError
    if (updatedRows && updatedRows.length > 0) return
  }

  throw new Error(`Could not safely decrement stock for ${table} record ${id}`)
}

export async function decrementOrderItemStock(
  supabase: SupabaseClient,
  item: StockOrderItem,
) {
  const quantity = Number(item.quantity_ordered || 1)

  if (!item.product_id || !item.color_id || !Number.isFinite(quantity) || quantity <= 0) return

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('product_type')
    .eq('id', item.product_id)
    .maybeSingle()

  if (productError) throw productError
  if (product?.product_type !== 'extension' && product?.product_type !== 'product') return

  await decrementStock(supabase, 'product_colors', item.color_id, quantity)
}
