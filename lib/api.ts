import { createClient } from '@/lib/supabase/client'

export interface Product {
  id: string
  name: string
  description: string
  price: number
  image_url: string | null
  is_trending: boolean
  is_newest: boolean
  created_at: string
}

export interface ProductColor {
  id: string
  product_id: string
  color_name: string
  color_hex: string
  image_url?: string | null
}

export interface ProductQuantity {
  id: string
  product_id: string
  length_inches: number
  weight_grams: number
  stock_quantity: number
}

export interface CartItem {
  id: string
  user_id: string
  product_id: string
  color_id: string
  quantity_id: string
  quantity_ordered: number
  product?: Product
  color?: ProductColor
  quantity?: ProductQuantity
}

export interface Order {
  id: string
  user_id: string
  total_amount: number
  status: string
  payment_reference: string
  created_at: string
}

// Fetch all products
export async function getProducts() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching products:', error)
    return []
  }

  return data as Product[]
}

// Fetch trending products
export async function getTrendingProducts() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_trending', true)
    .eq('is_newest', false)
    .limit(5)

  if (error) {
    console.error('Error fetching trending products:', error)
    return []
  }

  return data as Product[]
}

// Fetch newest products
export async function getNewestProducts() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_newest', true)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error fetching newest products:', error)
    return []
  }

  return data as Product[]
}

// Fetch product by ID with colors and quantities
export async function getProductDetails(productId: string) {
  const supabase = createClient()

  const [productRes, colorsRes, quantitiesRes] = await Promise.all([
    supabase.from('products').select('*').eq('id', productId).single(),
    supabase.from('product_colors').select('*').eq('product_id', productId),
    supabase
      .from('product_quantities')
      .select('*')
      .eq('product_id', productId)
      .order('length_inches', { ascending: true }),
  ])

  if (productRes.error) {
    console.error('Error fetching product:', productRes.error)
    return null
  }

  return {
    product: productRes.data as Product,
    colors: colorsRes.data as ProductColor[],
    quantities: quantitiesRes.data as ProductQuantity[],
  }
}

// Search products
export async function searchProducts(query: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .or(`name.ilike.%${query}%,description.ilike.%${query}%`)

  if (error) {
    console.error('Error searching products:', error)
    return []
  }

  return data as Product[]
}

// Get user cart
export async function getCart(userId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('cart_items')
    .select(
      `
    *,
    products(id, name, description, price, image_url, is_trending, is_newest, created_at),
    product_colors(id, product_id, color_name, color_hex, image_url),
    product_quantities(id, product_id, length_inches, weight_grams, stock_quantity)
  `
    )
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching cart:', error)
    return []
  }

  if (!data) {
    return []
  }

  // Process the data to ensure proper structure - Supabase returns arrays for relations
  return data.map((item: any) => {
    const product = Array.isArray(item.products) ? item.products[0] : item.products
    const color = Array.isArray(item.product_colors) ? item.product_colors[0] : item.product_colors
    const quantity = Array.isArray(item.product_quantities) ? item.product_quantities[0] : item.product_quantities

    return {
      ...item,
      product,
      color,
      quantity,
    }
  }) as CartItem[]
}

// Add to cart
export async function addToCart(
  userId: string,
  productId: string,
  colorId: string,
  quantityId: string,
  quantity: number
) {
  const supabase = createClient()

  // Check if item already in cart
  const { data: existingItem } = await supabase
    .from('cart_items')
    .select('*')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .eq('color_id', colorId)
    .eq('quantity_id', quantityId)
    .single()

  if (existingItem) {
    // Update quantity
    return await supabase
      .from('cart_items')
      .update({ quantity_ordered: existingItem.quantity_ordered + quantity })
      .eq('id', existingItem.id)
  }

  // Add new item
  return await supabase.from('cart_items').insert({
    user_id: userId,
    product_id: productId,
    color_id: colorId,
    quantity_id: quantityId,
    quantity_ordered: quantity,
  })
}

// Remove from cart
export async function removeFromCart(cartItemId: string) {
  const supabase = createClient()
  return await supabase.from('cart_items').delete().eq('id', cartItemId)
}

// Update cart item quantity
export async function updateCartItemQuantity(cartItemId: string, quantity: number) {
  const supabase = createClient()
  return await supabase
    .from('cart_items')
    .update({ quantity_ordered: quantity })
    .eq('id', cartItemId)
}

// Create order
export async function createOrder(
  userId: string,
  cartItems: CartItem[],
  totalAmount: number,
  deliveryType: 'delivery' | 'pickup' = 'delivery'
) {
  const supabase = createClient()

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      total_amount: totalAmount,
      status: 'pending',
      order_type: deliveryType,
      confirmation_status: 'not_confirmed',
      payment_reference: `ORD-${Date.now()}`,
    })
    .select()
    .single()

  if (orderError) {
    console.error('Error creating order:', orderError)
    return null
  }

  // Create order items and reduce inventory
  const orderItemsPromises = cartItems.map(async (item) => {
    await supabase.from('order_items').insert({
      order_id: order.id,
      product_id: item.product_id,
      color_id: item.color_id,
      quantity_id: item.quantity_id,
      quantity: item.quantity_ordered,
      price: item.product?.price || 0,
    })

    // Reduce stock
    if (item.quantity_id) {
      const { data: qty } = await supabase
        .from('product_quantities')
        .select('stock_quantity')
        .eq('id', item.quantity_id)
        .single()

      if (qty) {
        await supabase
          .from('product_quantities')
          .update({ stock_quantity: qty.stock_quantity - item.quantity_ordered })
          .eq('id', item.quantity_id)
      }
    }
  })

  await Promise.all(orderItemsPromises)

  // Clear cart
  await supabase.from('cart_items').delete().eq('user_id', userId)

  return order
}
