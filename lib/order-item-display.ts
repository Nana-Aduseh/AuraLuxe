type OrderItemRow = {
  id: string
  product_id?: string | null
  color_id?: string | null
  quantity_id?: string | null
  quantity_ordered?: number | null
  quantity?: number | null
  price_at_purchase?: number | null
  price?: number | null
}

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => any
    eq: (column: string, value: string) => any
    maybeSingle: () => Promise<{ data: any; error: any }>
    single: () => Promise<{ data: any; error: any }>
  }
}

export async function enrichOrderItemsForDisplay(
  supabase: SupabaseLike,
  items: OrderItemRow[],
) {
  return Promise.all(
    items.map(async (item) => {
      const productId = item.product_id || null
      const colorId = item.color_id || null
      const quantityId = item.quantity_id || null

      const [productRes, colorRes, quantityRes] = await Promise.all([
        productId
          ? supabase.from('products').select('id, name, price').eq('id', productId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        colorId
          ? supabase.from('product_colors').select('id, color_name').eq('id', colorId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        quantityId
          ? supabase.from('product_quantities').select('id, length_inches').eq('id', quantityId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      return {
        ...item,
        product: productRes.data || null,
        color: colorRes.data || null,
        quantity_data: quantityRes.data || null,
        product_name: productRes.data?.name || null,
        color_name: colorRes.data?.color_name || null,
        length_inches: quantityRes.data?.length_inches || null,
      }
    }),
  )
}
