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

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productSlug = params.productId as string

  const [product, setProduct] = useState<Product | null>(null)
  const [colors, setColors] = useState<ProductColor[]>([])
  const [quantities, setQuantities] = useState<ProductQuantity[]>([])
  const [selectedQuantityId, setSelectedQuantityId] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [displayImageUrl, setDisplayImageUrl] = useState('')
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
      const matchedProduct = await getProductBySlug(productSlug, 'extension')

      if (!matchedProduct) {
        router.push('/extensions')
        return
      }

      const details = await getProductDetails(matchedProduct.id)

      if (!details) {
        router.push('/extensions')
        return
      }

      setProduct(details.product)
      setColors(details.colors)
      setQuantities(details.quantities)
      setSelectedColor(details.colors[0]?.id || '')
      setDisplayImageUrl(details.colors[0]?.image_url || details.product.image_url || '')
      setSelectedQuantityId(details.quantities[0]?.id || null)
      setLoading(false)
    }

    if (productSlug) {
      loadProduct()
    }
  }, [productSlug, router])

  useEffect(() => {
    const selectedColorData = colors.find((color) => color.id === selectedColor)
    setDisplayImageUrl(selectedColorData?.image_url || product?.image_url || '')
  }, [selectedColor, colors, product?.image_url])

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600" />
      </main>
    )
  }

  if (!product) {
    return null
  }

  const selectedColorData = colors.find((color) => color.id === selectedColor)
  const pricing = getProductPricing(product)
  const isSoldOut = (selectedColorData?.stock_quantity || 0) <= 0;

  const handleAddToCart = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setShowSignInModal(true)
      return
    }

    if (!selectedColor) {
      toast.error("Please select a color first.")
      return
    }

    if (quantity > (selectedColorData?.stock_quantity || 0)) {
      toast.error(`Sorry, only ${selectedColorData?.stock_quantity || 0} pieces available in this color.`)
      return
    }

    setProcessing(true)
    try {
      await addToCart(
        user.id,
        product.id,
        selectedColor,
        selectedQuantityId,
        quantity,
      )

      setShowAddToCartSuccess(true)
      setQuantity(1)
    } catch (error: any) {
      console.error('Error adding to cart:', error?.message || error)
      toast.error(error?.message || 'Failed to add to cart. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const handleBuyNow = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (quantity > (selectedColorData?.stock_quantity || 0)) {
      toast.error(`Sorry, only ${selectedColorData?.stock_quantity || 0} pieces available in this color.`)
      return
    }

    setProcessing(true)
    try {
      console.log(`[Extensions/BuyNow] Creating buy-now item:`, {
        productId: product.id,
        productName: product.name,
        currentPrice: pricing.currentPrice,
        hasPromo: pricing.hasPromo,
        originalPrice: pricing.originalPrice,
        quantity,
        color: selectedColor,
      });

      const buyNowItem = {
        id: `buy-now-${product.id}-${selectedColor}-${selectedQuantityId || 'null'}`,
        user_id: user?.id || '',
        product_id: product.id,
        color_id: selectedColor,
        quantity_id: selectedQuantityId,
        quantity_ordered: quantity,
        product: {
          ...product,
          price: pricing.currentPrice,
        },
        color: selectedColorData,
        quantity: undefined,
      }

      if (user) {
        window.sessionStorage.setItem('aura-luxe-buy-now', JSON.stringify(buyNowItem))
        console.log(`[Extensions/BuyNow] Saved to sessionStorage (authenticated user)`);
      } else {
        saveGuestBuyNowItem(buyNowItem)
        console.log(`[Extensions/BuyNow] Saved to guest storage (guest user)`);
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
      <div className="max-w-7xl mx-auto">
        <Link href="/extensions" className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Extensions
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-8 items-start">
          <div className="min-w-0 space-y-4">
            <div className="bg-card rounded-3xl overflow-hidden border border-border/30 shadow-sm">
              <div className="relative aspect-[4/4] bg-muted">
                {displayImageUrl ? (
                  <Image
                    src={displayImageUrl}
                    alt={selectedColorData?.color_name ? `${product.name} - ${selectedColorData.color_name}` : product.name}
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

            <div className="lg:hidden bg-card rounded-3xl border border-border/30 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Choose a color</p>
                  <p className="text-xs text-foreground/60">Tap a picture to preview it above</p>
                </div>
                {selectedColorData && (
                  <span className="text-xs font-medium rounded-full bg-amber-50 text-amber-700 px-3 py-1">
                    {selectedColorData.color_name}
                  </span>
                )}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {colors.map((color) => {
                  const isSelected = selectedColor === color.id
                  const colorSoldOut = (color.stock_quantity || 0) <= 0;

                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setSelectedColor(color.id)}
                      className={`min-w-[5.5rem] rounded-2xl border p-2 text-left transition-all ${isSelected ? 'border-amber-600 bg-amber-50 shadow-sm' : 'border-border/30 bg-background hover:border-amber-400/50'} ${colorSoldOut ? 'opacity-50' : ''}`}
                      aria-pressed={isSelected}
                      aria-label={`Select ${color.color_name}`}
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
                        {color.image_url ? (
                          <Image
                            src={color.image_url}
                            alt={color.color_name}
                            fill
                            sizes="96px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: color.color_hex || '#ccc' }}>
                            <span className="text-[10px] font-semibold text-white drop-shadow">
                              {color.color_name.slice(0, 1)}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-xs font-medium text-foreground line-clamp-2">
                        {color.color_name}
                      </p>
                      {colorSoldOut && (
                        <p className="mt-1 text-[10px] font-semibold text-red-500">Sold out</p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="min-w-0 bg-card rounded-3xl border border-border/30 shadow-sm p-6 sm:p-8 lg:sticky lg:top-24">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 text-balance">{product.name}</h1>
            <p className="text-foreground/70 leading-relaxed mb-6">
              {product.description}
              {product.length_inches || product.weight_grams ? (
                <span className="block mt-2 font-medium text-foreground/90">
                  {product.length_inches ? `Length: ${product.length_inches}" ` : ''}
                  {product.length_inches && product.weight_grams ? '• ' : ''}
                  {product.weight_grams ? `Weight: ${product.weight_grams}g` : ''}
                </span>
              ) : null}
            </p>

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

            {selectedColorData && (
              <div className="mb-6 rounded-2xl border border-border/30 bg-background p-4">
                <p className="text-sm font-semibold text-foreground mb-2">Color Availability</p>
                <p className="text-sm text-foreground/70">{selectedColorData.stock_quantity && selectedColorData.stock_quantity > 0 ? `${selectedColorData.stock_quantity} pieces in stock` : <span className="text-red-600 font-medium">Sold out</span>}</p>
              </div>
            )}

            <div className="mb-6 hidden lg:block">
              <label className="block text-sm font-semibold text-foreground mb-3">Color</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {colors.map((color) => {
                  const colorSoldOut = (color.stock_quantity || 0) <= 0;
                  return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setSelectedColor(color.id)}
                    className={`rounded-2xl border p-4 text-left transition-all ${selectedColor === color.id ? 'border-amber-600 bg-amber-50' : 'border-border/30 hover:border-amber-400/50'} ${colorSoldOut ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {color.image_url ? (
                        <div className="relative h-8 w-8 rounded-full border overflow-hidden shrink-0">
                          <Image src={color.image_url} alt={color.color_name} fill sizes="32px" className="object-cover" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full border shrink-0" style={{ backgroundColor: color.color_hex || '#ccc' }} />
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{color.color_name}</span>
                        {colorSoldOut ? <span className="text-xs text-red-500 font-semibold">Sold out</span> : <span className="text-xs text-foreground/60">{color.stock_quantity} left</span>}
                      </div>
                    </div>
                  </button>
                )})}
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-semibold text-foreground mb-3">Quantity</label>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-11 w-11 rounded-xl border border-border/30 hover:bg-muted text-lg shrink-0">−</button>
                <input
                  type="number"
                  min="1"
                  max={selectedColorData?.stock_quantity || 1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 rounded-xl border border-border/30 bg-background px-3 py-2 text-center shrink-0"
                />
                <button type="button" onClick={() => setQuantity(quantity + 1)} className="h-11 w-11 rounded-xl border border-border/30 hover:bg-muted text-lg shrink-0">+</button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleBuyNow}
                disabled={processing || isSoldOut || quantity > (selectedColorData?.stock_quantity || 0)}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <Bolt className="w-5 h-5" />
                {processing ? 'Processing...' : 'Buy Now'}
              </Button>
              <Button
                onClick={handleAddToCart}
                disabled={processing || isSoldOut || quantity > (selectedColorData?.stock_quantity || 0)}
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
        productImage={displayImageUrl}
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