'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/currency'
import { Trash2, ArrowLeft } from 'lucide-react'
import {
  getCart,
  removeFromCart,
  updateCartItemQuantity,
  CartItem,
  addToCart,
  getEffectiveProductPrice,
} from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  clearGuestCartItems,
  getGuestCartItems,
  removeGuestCartItem,
  updateGuestCartItemQuantity,
} from '@/lib/guest-cart'
import { CartAccessModal } from '@/components/auth/cart-access-modal'

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isGuestCart, setIsGuestCart] = useState(false)
  const [showAccessModal, setShowAccessModal] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const loadCart = async (userId?: string | null) => {
    if (!userId) {
      setCartItems(getGuestCartItems() as CartItem[])
      setIsGuestCart(true)
      return
    }

    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select(
          `
        *,
        products(id, name, description, price, promo_enabled, original_price, discounted_price, image_url, is_trending, is_newest, created_at, product_type, weight_grams, length_inches),
        product_colors(id, product_id, color_name, color_hex, image_url, stock_quantity),
        product_quantities(id, product_id, length_inches, weight_grams, stock_quantity)
      `
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })

      if (error) {
        console.error('Error loading cart:', error)
        console.error('Error details:', error.message, error.code)
        setCartItems([])
        return
      }

      if (data) {
        console.log('Cart raw data:', data)
        
        // Process the data to ensure proper structure
        const processedItems = data.map((item: any) => {
          // Supabase returns arrays for relations by default, get the first element
          const product = Array.isArray(item.products) ? item.products[0] : item.products
          const color = Array.isArray(item.product_colors) ? item.product_colors[0] : item.product_colors
          const quantity = Array.isArray(item.product_quantities) ? item.product_quantities[0] : item.product_quantities
          
          return {
            ...item,
            product,
            color,
            quantity
          }
        })
        
        console.log('Cart processed items:', processedItems)
        setCartItems(processedItems)
      } else {
        setCartItems([])
      }
      setIsGuestCart(false)
    } catch (err) {
      console.error('Exception loading cart:', err)
      setCartItems([])
    }
  }

  useEffect(() => {
    let channel: any = null
    let isActive = true

    const initializeCart = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!isActive) return

      setUser(user)

      if (!user) {
        // Restrict access by showing the modal but still load guest items
        setShowAccessModal(true)
        await loadCart(null)
      } else {
        // Sync guest items to account if any exist
        const guestItems = getGuestCartItems()
        if (guestItems.length > 0) {
          try {
            for (const item of guestItems) {
              await addToCart(
                user.id,
                item.product_id,
                item.color_id,
                item.quantity_id || null,
                item.quantity_ordered
              )
            }
            clearGuestCartItems()
            window.dispatchEvent(new Event('aura-luxe-cart-updated'))
        } catch (error: any) {
          console.error('Error syncing guest cart to account:', error.message || error)
            // We don't clear guest items if sync fails to prevent data loss
          }
        }
        // Load the actual database cart
        await loadCart(user.id)

        channel = supabase
          .channel(`cart-page-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'cart_items',
              filter: `user_id=eq.${user.id}`,
            },
            async () => {
              // Reload cart when items change
              await loadCart(user.id)
            }
          )
          .subscribe()
      }

      if (!isActive) return
      setLoading(false)
    }

    initializeCart()

    return () => {
      isActive = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  const handleRemove = async (cartItemId: string) => {
    if (isGuestCart) {
      setCartItems(removeGuestCartItem(cartItemId) as CartItem[])
      window.dispatchEvent(new Event('aura-luxe-cart-updated'))
      return
    }

    await removeFromCart(cartItemId)
    setCartItems((items) => items.filter((item) => item.id !== cartItemId))
    window.dispatchEvent(new Event('aura-luxe-cart-updated'))
  }

  const handleQuantityChange = async (cartItemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      handleRemove(cartItemId)
      return
    }

    if (isGuestCart) {
      setCartItems(updateGuestCartItemQuantity(cartItemId, newQuantity) as CartItem[])
      window.dispatchEvent(new Event('aura-luxe-cart-updated'))
      return
    }

    await updateCartItemQuantity(cartItemId, newQuantity)
    setCartItems((items) =>
      items.map((item) =>
        item.id === cartItemId
          ? { ...item, quantity_ordered: newQuantity }
          : item
      )
    )
    window.dispatchEvent(new Event('aura-luxe-cart-updated'))
  }

  const total = cartItems.reduce((sum, item) => {
    return (
      sum + getEffectiveProductPrice(item.product) * (item.quantity_ordered || 1)
    );
  }, 0)

  const handleSignInToContinue = () => {
    window.sessionStorage.setItem('aura-luxe-checkout-return', '/checkout?mode=guest')
    router.push('/auth/login?returnTo=%2Fcheckout%3Fmode%3Dguest')
  }

  const handleContinueGuest = () => {
    router.push('/checkout?mode=guest')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-background">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mt-6 text-balance">Shopping Cart</h1>
        </div>

        {cartItems.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-foreground/70 text-lg mb-8">
              Your cart is empty. Start adding some extensions!
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild className="bg-primary hover:bg-primary/90">
                <Link href="/extensions">Shop Extensions</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="space-y-4">
                {cartItems.map((item) => {
                  const product = item.product || {}
                  const color = item.color || {}
                  const quantity = item.quantity || {}
                  
                  const unitPrice = getEffectiveProductPrice(product)
                  const itemSubtotal = unitPrice * (item.quantity_ordered || 1)
                  const maxStock = color.stock_quantity ?? 999
                  
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row gap-4 p-4 sm:p-6 bg-card rounded-lg border border-border/30 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                    >
                      {/* Image */}
                      <div className="w-24 h-24 sm:w-24 sm:h-24 bg-muted rounded flex-shrink-0 overflow-hidden self-start">
                        {color.image_url || product.image_url ? (
                          <img
                            src={color.image_url || product.image_url || '/placeholder.png'}
                            alt={product.name || 'Product'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No image</div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-lg">
                          {product.name || 'Unknown Product'}
                        </h3>
                        <p className="text-sm text-foreground/70 mt-1">
                          Color: <span className="font-medium">{color.color_name || 'N/A'}</span>
                        </p>
                        {product.product_type === 'extension' && (
                          <p className="text-sm text-foreground/70 mt-2">
                            Length: <span className="font-medium">{product.length_inches || quantity.length_inches || 'N/A'}{'"'}</span> • Weight: <span className="font-medium">{product.weight_grams || quantity.weight_grams || 'N/A'}g</span>
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-3">
                          <div>
                            {product.promo_enabled && (product.discounted_price || 0) < (product.price || 0) && (
                                <span className="text-xs text-foreground/50 line-through block">
                                  {formatPrice(product.original_price || product.price || 0)}
                                </span>
                            )}
                            <p className="text-lg font-semibold text-primary">
                              {formatPrice(unitPrice)} each
                            </p>
                          </div>
                          <p className="text-sm text-foreground/60">
                            Subtotal: <span className="font-semibold text-foreground">{formatPrice(itemSubtotal)}</span>
                          </p>
                        </div>
                      </div>

                      {/* Quantity & Actions */}
                      <div className="flex flex-col sm:items-end justify-between gap-4 w-full sm:w-auto">
                        <button
                          onClick={() => handleRemove(item.id)}
                          className="text-destructive hover:text-destructive/80 p-2 transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>

                        <div className="flex flex-col items-start sm:items-center gap-2 w-full sm:w-auto">
                          <div className="flex items-center gap-1 border border-border/30 bg-background rounded w-full sm:w-auto justify-between sm:justify-start">
                            <button
                              onClick={() =>
                                handleQuantityChange(
                                  item.id,
                                  item.quantity_ordered - 1
                                )
                              }
                              disabled={item.quantity_ordered <= 1}
                              className="px-3 py-2 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold text-foreground"
                            >
                              −
                            </button>
                            <span className="px-3 py-2 font-semibold text-foreground min-w-[2rem] text-center">
                              {item.quantity_ordered}
                            </span>
                            <button
                              onClick={() =>
                                handleQuantityChange(
                                  item.id,
                                  Math.min(item.quantity_ordered + 1, maxStock)
                                )
                              }
                              disabled={item.quantity_ordered >= maxStock}
                              className="px-3 py-2 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold text-foreground"
                            >
                              +
                            </button>
                          </div>
                          <p className="text-xs text-foreground/60 text-left sm:text-right w-full">
                            {maxStock - item.quantity_ordered} available
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-card rounded-lg p-6 border border-border/30 shadow-md sticky top-24">
                <h2 className="text-xl font-bold text-foreground mb-6">
                  Order Summary
                </h2>

                {/* Items List */}
                <div className="mb-6 pb-6 border-b border-border/20 max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {cartItems.map((item) => {
                      const product = item.product || {}
                      const color = item.color || {}
                      return (
                        <div key={item.id} className="text-sm text-foreground/80">
                          <span className="font-medium">{product.name || 'Unknown'}</span>
                          {color.color_name && (
                            <span className="text-foreground/60"> ({color.color_name})</span>
                          )}
                          <div className="text-xs text-foreground/60 mt-1">
                            {item.quantity_ordered} × {formatPrice(getEffectiveProductPrice(product))} = <span className="font-semibold">{formatPrice(getEffectiveProductPrice(product) * item.quantity_ordered)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-3 mb-6 pb-6 border-b border-border/20">
                  <div className="flex justify-between text-foreground">
                    <span className="font-semibold">Subtotal</span>
                    <span className="font-semibold">{formatPrice(total)}</span>
                  </div>
                  <div className="flex justify-between text-foreground/70 text-sm">
                    <span>Delivery</span>
                    <span className="text-amber-600 font-medium">To be determined</span>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <span className="text-lg font-bold text-foreground">
                    Total
                  </span>
                  <span className="text-3xl font-bold text-primary">
                    {formatPrice(total)}
                  </span>
                </div>

                <Button
                  asChild
                  className="w-full bg-primary hover:bg-primary/90 text-white py-6 font-semibold text-base rounded-lg transition-all hover:shadow-lg"
                >
                  <Link href={isGuestCart ? "/checkout?mode=guest" : "/checkout?mode=cart"}>Proceed to Checkout</Link>
                </Button>

                {isGuestCart && (
                  <Button
                    onClick={handleSignInToContinue}
                    variant="outline"
                    className="w-full mt-3 py-6 font-semibold text-base"
                  >
                    Sign In to Continue
                  </Button>
                )}

                <Button
                  asChild
                  variant="outline"
                  className="w-full mt-3 py-6 font-semibold text-base"
                >
                  <Link href="/extensions">Continue Shopping</Link>
                </Button>

                <p className="text-xs text-foreground/60 text-center mt-4">
                  ✓ Secure checkout • 100% authentic hair
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <CartAccessModal 
        isOpen={showAccessModal} 
        onClose={() => setShowAccessModal(false)} 
      />
    </main>
  )
}
