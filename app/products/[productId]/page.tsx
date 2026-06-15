'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/currency'
import {
  Product,
  ProductColor,
  ProductQuantity,
  getProductBySlug,
  getProductDetails,
  getProductPricing,
  addToCart,
} from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import {
  saveGuestBuyNowItem,
} from '@/lib/guest-cart'
import { ArrowLeft, Bolt, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { AddToCartSuccessModal } from '@/components/auth/add-to-cart-modal'
import { AddToCartRequiresSignInModal } from '@/components/auth/add-to-cart-signin-modal'

export default function HairProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productSlug = params.productId as string

  const [product, setProduct] = useState<Product | null>(null)
  const [defaultColor, setDefaultColor] = useState<ProductColor | null>(null)
  const [selectedQuantityId, setSelectedQuantityId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showAddToCartSuccess, setShowAddToCartSuccess] = useState(false)
  const [showSignInModal, setShowSignInModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    const loadProduct = async () => {
      setLoading(true)
      const matchedProduct = await getProductBySlug(productSlug, 'product')

      if (!matchedProduct) {
        router.push('/products')
        return
      }

      const details = await getProductDetails(matchedProduct.id)

      if (!details) {
        router.push('/products')
        return
      }

      setProduct(details.product)
      setDefaultColor(details.colors[0] || null)
      setSelectedQuantityId(details.quantities[0]?.id || null)
      setLoading(false)
    }

    if (productSlug) {
      loadProduct()
    }
  }, [productSlug, router])

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600" />
      </main>
    )
  }

  if (!product || !defaultColor) {
    return null
  }

  const pricing = getProductPricing(product)
  const activeImageUrl = product.image_url || ''
  const availableStock = defaultColor?.stock_quantity || 0;

  const handleAddToCart = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setShowSignInModal(true)
      return
    }

    if (quantity > availableStock) {
      toast.error(
        `Sorry, only ${availableStock} ${availableStock === 1 ? 'piece' : 'pieces'} available.`,
      )
      return
    }

    setProcessing(true)
    try {
      await addToCart(user.id, product.id, defaultColor.id, selectedQuantityId, quantity)
      setShowAddToCartSuccess(true)
      setQuantity(1)
    } catch (error: any) {
      console.error('Error adding to cart:', error.message || error)
      toast.error(error.message || 'Failed to add to cart. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const handleBuyNow = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (quantity > availableStock) {
      toast.error(
        `Sorry, only ${availableStock} ${availableStock === 1 ? 'piece' : 'pieces'} available.`,
      )
      return
    }

    setProcessing(true)
    try {
      console.log(`[Products/BuyNow] Creating buy-now item:`, {
        productId: product.id,
        productName: product.name,
        currentPrice: pricing.currentPrice,
        hasPromo: pricing.hasPromo,
        originalPrice: pricing.originalPrice,
        quantity,
      });

      const buyNowItem = {
        id: `buy-now-${product.id}-${defaultColor.id}-${selectedQuantityId || 'null'}`,
        user_id: user?.id || '',
        product_id: product.id,
        color_id: defaultColor.id,
        quantity_id: selectedQuantityId,
        quantity_ordered: quantity,
        product: {
          ...product,
          price: pricing.currentPrice,
        },
        color: defaultColor,
        quantity: undefined,
      }

      if (user) {
        window.sessionStorage.setItem('aura-luxe-buy-now', JSON.stringify(buyNowItem))
        console.log(`[Products/BuyNow] Saved to sessionStorage (authenticated user)`);
      } else {
        saveGuestBuyNowItem(buyNowItem)
        console.log(`[Products/BuyNow] Saved to guest storage (guest user)`);
      }
      window.sessionStorage.setItem('aura-luxe-checkout-mode', 'buy-now')

      router.push('/checkout?mode=buy-now')
    } catch (error) {
      console.error('Error:', error)
      toast.error('Failed to proceed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/products" className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Products
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="bg-card rounded-3xl overflow-hidden border border-border/30 shadow-sm">
            <div className="relative aspect-square bg-muted">
              {activeImageUrl ? (
                <Image
                  src={activeImageUrl}
                  alt={product.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-contain"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-foreground/40">No image</div>
              )}
            </div>
          </div>

          <div className="bg-card rounded-3xl border border-border/30 shadow-sm p-6 sm:p-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 text-balance">{product.name}</h1>
            <p className="text-foreground/70 leading-relaxed mb-6">{product.description}</p>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 mb-6">
              {pricing.hasPromo && pricing.originalPrice ? (
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-foreground/50 line-through">{formatPrice(pricing.originalPrice)}</span>
                  <span className="text-3xl font-bold text-amber-700">{formatPrice(pricing.currentPrice)}</span>
                </div>
              ) : (
                <span className="text-3xl font-bold text-amber-700">{formatPrice(pricing.currentPrice)}</span>
              )}
            </div>

            <div className="mb-6 rounded-2xl border border-border/30 bg-background p-4">
              <p className="text-sm font-semibold text-foreground mb-2">Availability</p>
              <p className="text-sm text-foreground/70">
                {availableStock > 0
                  ? `${availableStock} pieces in stock`
                  : 'Out of stock'}
              </p>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-semibold text-foreground mb-3">Quantity</label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="h-11 w-11 rounded-xl border border-border/30 hover:bg-muted text-lg shrink-0"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, availableStock)}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.max(
                        1,
                        Math.min(
                          parseInt(e.target.value) || 1,
                          Math.max(1, availableStock),
                        ),
                      ),
                    )
                  }
                  className="w-20 rounded-xl border border-border/30 bg-background px-3 py-2 text-center shrink-0"
                />
                <button
                  type="button"
                  onClick={() =>
                    setQuantity(
                      Math.min(quantity + 1, Math.max(1, availableStock)),
                    )
                  }
                  className="h-11 w-11 rounded-xl border border-border/30 hover:bg-muted text-lg shrink-0"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleBuyNow}
                disabled={processing || availableStock <= 0}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <Bolt className="w-5 h-5" />
                {processing ? 'Processing...' : 'Buy Now'}
              </Button>
              <Button
                onClick={handleAddToCart}
                disabled={processing || availableStock <= 0 || quantity > availableStock}
                variant="outline"
                className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                {processing ? 'Adding...' : 'Add to Cart'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AddToCartSuccessModal
        isOpen={showAddToCartSuccess}
        productName={product?.name || ''}
        productImage={product?.image_url ?? undefined}
        quantity={quantity}
        onClose={() => setShowAddToCartSuccess(false)}
      />

      <AddToCartRequiresSignInModal
        isOpen={showSignInModal}
        onClose={() => setShowSignInModal(false)}
      />
    </main>
  )
}
