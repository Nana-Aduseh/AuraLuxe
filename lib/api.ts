import { createClient } from "@/lib/supabase/client";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  product_type?: "extension" | "product";
  promo_enabled?: boolean;
  original_price?: number | null;
  discounted_price?: number | null;
  weight_grams?: number | null;
  length_inches?: number | null;
  image_url: string | null;
  is_trending: boolean;
  is_newest: boolean;
  created_at: string;
}

export function getEffectiveProductPrice(product?: Product | null) {
  if (!product) {
    return 0;
  }

  if (
    product.promo_enabled &&
    typeof product.discounted_price === "number" &&
    product.discounted_price > 0
  ) {
    return product.discounted_price;
  }

  return product.price || 0;
}

export function slugifyProductName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getProductPricing(product?: Product | null) {
  const hasPromo = Boolean(
    product?.promo_enabled &&
      typeof product.discounted_price === "number" &&
      product.discounted_price > 0,
  );

  const currentPrice = getEffectiveProductPrice(product);
  const originalPrice = hasPromo
    ? product?.original_price || product?.price || currentPrice
    : null;

  return {
    hasPromo,
    currentPrice,
    originalPrice,
  };
}

export async function getProductBySlug(
  productSlug: string,
  productType?: "extension" | "product",
) {
  const products = productType
    ? await getProductsByType(productType)
    : await getProducts();
  const normalizedSlug = productSlug.toLowerCase();

  return products.find(
    (product) => slugifyProductName(product.name) === normalizedSlug,
  ) ?? null;
}

export interface ProductColor {
  id: string;
  product_id: string;
  color_name: string;
  color_hex: string;
  image_url?: string | null;
  stock_quantity?: number;
}

export interface ProductQuantity {
  id: string;
  product_id: string;
  length_inches: number;
  weight_grams: number;
  stock_quantity: number;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  color_id: string;
  quantity_id: string;
  quantity_ordered: number;
  product?: Product;
  color?: ProductColor;
  quantity?: ProductQuantity;
}

export interface Order {
  id: string;
  user_id: string;
  total_amount: number;
  status: string;
  payment_reference: string;
  created_at: string;
}

export interface GuestCheckoutInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  town: string;
  region: string;
}

// Fetch all products
export async function getProducts() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching products:", error);
    return [];
  }

  return data as Product[];
}

export async function getProductsByType(productType: "extension" | "product") {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("product_type", productType)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`Error fetching ${productType} products:`, error);
    return [];
  }

  return data as Product[];
}

// Fetch trending products
export async function getTrendingProducts() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("product_type", "extension")
    .eq("is_trending", true)
    .limit(5);

  if (error) {
    console.error("Error fetching trending products:", error);
    return [];
  }

  return data as Product[];
}

// Fetch product by ID with colors and quantities
export async function getProductDetails(productId: string) {
  const supabase = createClient();

  const [productRes, colorsRes, quantitiesRes] = await Promise.all([
    supabase.from("products").select("*").eq("id", productId).single(),
    supabase.from("product_colors").select("*").eq("product_id", productId),
    supabase
      .from("product_quantities")
      .select("*")
      .eq("product_id", productId)
      .order("length_inches", { ascending: true }),
  ]);

  if (productRes.error) {
    console.error("Error fetching product:", productRes.error);
    return null;
  }

  return {
    product: productRes.data as Product,
    colors: colorsRes.data as ProductColor[],
    quantities: quantitiesRes.data as ProductQuantity[],
  };
}

// Search products
export async function searchProducts(query: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .or(`name.ilike.%${query}%,description.ilike.%${query}%`);

  if (error) {
    console.error("Error searching products:", error);
    return [];
  }

  return data as Product[];
}

// Get user cart
export async function getCart(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select(
      `
    *,
    products(id, name, description, price, promo_enabled, original_price, discounted_price, image_url, is_trending, is_newest, created_at, product_type, weight_grams, length_inches),
    product_colors(id, product_id, color_name, color_hex, image_url, stock_quantity),
    product_quantities(id, product_id, length_inches, weight_grams, stock_quantity)
  `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("Error fetching cart:", error);
    return [];
  }

  if (!data) {
    return [];
  }

  // Process the data to ensure proper structure - Supabase returns arrays for relations
  return data.map((item: any) => {
    const product = Array.isArray(item.products)
      ? item.products[0]
      : item.products;
    const color = Array.isArray(item.product_colors)
      ? item.product_colors[0]
      : item.product_colors;
    const quantity = Array.isArray(item.product_quantities)
      ? item.product_quantities[0]
      : item.product_quantities;

    return {
      ...item,
      product,
      color,
      quantity,
    };
  }) as CartItem[];
}

// Add to cart
export async function addToCart(
  userId: string,
  productId: string,
  colorId: string,
  quantityId: string | null = null,
  quantity: number,
) {
  const supabase = createClient();

  // Check if item already in cart
  let query = supabase
    .from("cart_items")
    .select("*")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .eq("color_id", colorId);

  if (quantityId) {
    query = query.eq("quantity_id", quantityId);
  } else {
    query = query.is("quantity_id", null);
  }

  const { data: existingItem, error: fetchError } = await query.maybeSingle();
  if (fetchError) throw fetchError;

  if (existingItem) {
    // Update quantity
    const { error: updateError } = await supabase
      .from("cart_items")
      .update({ quantity_ordered: existingItem.quantity_ordered + quantity })
      .eq("id", existingItem.id);
    if (updateError) throw updateError;
    return;
  }

  // Add new item
  const { error: insertError } = await supabase.from("cart_items").insert({
    user_id: userId,
    product_id: productId,
    color_id: colorId,
    quantity_id: quantityId,
    quantity_ordered: quantity,
  });
  if (insertError) throw insertError;
}

// Remove from cart
export async function removeFromCart(cartItemId: string) {
  const supabase = createClient();
  return await supabase.from("cart_items").delete().eq("id", cartItemId);
}

// Update cart item quantity
export async function updateCartItemQuantity(
  cartItemId: string,
  quantity: number,
) {
  const supabase = createClient();
  return await supabase
    .from("cart_items")
    .update({ quantity_ordered: quantity })
    .eq("id", cartItemId);
}

// Create order
export async function createOrder(
  userId: string | null,
  cartItems: CartItem[],
  totalAmount: number,
  deliveryType: "delivery" | "pickup" = "delivery",
  shouldClearCart: boolean = true,
  guestInfo?: GuestCheckoutInfo,
) {
  const supabase = createClient();

  if (!userId) {
    const response = await fetch("/api/orders/guest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cartItems,
        totalAmount,
        deliveryType,
        guestInfo,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || "Unable to create guest order.");
    }

    return (await response.json()) as Order & {
      guest_access_token?: string;
    };
  }

  console.log("Creating order with", cartItems.length, "items");
  console.log("Cart items:", cartItems);

  // Create order with basic fields (new fields added via migration if available)
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      total_amount: totalAmount,
      status: "pending",
      payment_reference: `ORD-${Date.now()}`,
    })
    .select()
    .single();

  if (orderError) {
    console.error("Error creating order:", orderError);
    return null;
  }

  // If new columns exist, update them
  if (order && order.id) {
    try {
      await supabase
        .from("orders")
        .update({
          order_type: deliveryType,
          confirmation_status: "not_confirmed",
        })
        .eq("id", order.id);
    } catch (e) {
      // Silently ignore if new columns don't exist yet
    }
  }

  // Create order items without reducing inventory yet.
  // Inventory is now reduced only after Paystack verification finalizes the order.
  const orderItemsPromises = cartItems.map(async (item) => {
    const basePayload = {
      order_id: order?.id,
      product_id: item.product_id,
      color_id: item.color_id,
      quantity_id: item.quantity_id,
    };

    // Prefer the current schema columns first.
    let { error: itemError } = await supabase.from("order_items").insert({
      ...basePayload,
      quantity_ordered: item.quantity_ordered,
      price_at_purchase: getEffectiveProductPrice(item.product),
    });

    // Fallback for older schemas that still use quantity/price.
    if (itemError) {
      const legacyInsert = await supabase.from("order_items").insert({
        ...basePayload,
        quantity: item.quantity_ordered,
        price: getEffectiveProductPrice(item.product),
      });
      itemError = legacyInsert.error;
    }

    if (itemError) {
      console.error("Error creating order item:", itemError);
    }

  });

  await Promise.all(orderItemsPromises);

  // Clear cart only for normal cart checkout flows
  if (shouldClearCart) {
    await supabase.from("cart_items").delete().eq("user_id", userId);
  }

  return order;
}
