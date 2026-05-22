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
  addGuestCartItem,
  saveGuestBuyNowItem,
} from '@/lib/guest-cart'
import { ArrowLeft, Bolt, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productSlug = params.productId as string

  const [product, setProduct] = useState<Product | null>(null)
  const [colors, setColors] = useState<ProductColor[]>([])
  const [quantities, setQuantities] = useState<ProductQuantity[]>([])
  const [selectedColor, setSelectedColor] = useState('')
  const [selectedQuantity, setSelectedQuantity] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [displayImageUrl, setDisplayImageUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    const loadProduct = async () => {
      setLoading(true)
      const matchedProduct = await getProductBySlug(productSlug)

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
      setSelectedQuantity(details.quantities[0]?.id || '')
      setDisplayImageUrl(details.colors[0]?.image_url || details.product.image_url || '')
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
  const selectedQtyData = quantities.find((qty) => qty.id === selectedQuantity)
  const pricing = getProductPricing(product)

  const handleAddToCart = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    setProcessing(true)
    try {
      if (user) {
        await addToCart(
          user.id,
          product.id,
          selectedColor,
          selectedQuantity,
          quantity,
        )
      } else {
        addGuestCartItem(
          product,
          selectedColorData || null,
          selectedQtyData || null,
          quantity,
        )
      }

      toast.success('Added to cart successfully!')
    } catch (error) {
      console.error('Error adding to cart:', error)
      toast.error('Failed to add to cart. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const handleBuyNow = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    setProcessing(true)
    try {
      const buyNowItem = {
        id: `buy-now-${product.id}-${selectedColor}-${selectedQuantity}`,
        user_id: user?.id || '',
        product_id: product.id,
        color_id: selectedColor,
        quantity_id: selectedQuantity,
        quantity_ordered: quantity,
        product: {
          ...product,
          price: pricing.currentPrice,
        },
        color: selectedColorData,
        quantity: selectedQtyData,
      }

      if (user) {
        window.sessionStorage.setItem('aura-luxe-buy-now', JSON.stringify(buyNowItem))
        window.sessionStorage.setItem('aura-luxe-checkout-mode', 'buy-now')
      } else {
        saveGuestBuyNowItem(buyNowItem)
        window.sessionStorage.setItem('aura-luxe-checkout-mode', 'guest')
      }

      router.push(user ? '/checkout?mode=buy-now' : '/checkout?mode=guest')
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
                    className="object-cover"
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

                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setSelectedColor(color.id)}
                      className={`min-w-[5.5rem] rounded-2xl border p-2 text-left transition-all ${isSelected ? 'border-amber-600 bg-amber-50 shadow-sm' : 'border-border/30 bg-background hover:border-amber-400/50'}`}
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
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="min-w-0 bg-card rounded-3xl border border-border/30 shadow-sm p-6 sm:p-8 lg:sticky lg:top-24">
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

            {selectedQtyData && (
              <div className="mb-6 rounded-2xl border border-border/30 bg-background p-4">
                <p className="text-sm font-semibold text-foreground mb-2">Product Info</p>
                <p className="text-sm text-foreground/70">Length: {selectedQtyData.length_inches}"</p>
                <p className="text-sm text-foreground/70">Availability: {selectedQtyData.stock_quantity > 0 ? `${selectedQtyData.stock_quantity} pieces in stock` : 'Out of stock - still available to order'}</p>
              </div>
            )}

            <div className="mb-6 hidden lg:block">
              <label className="block text-sm font-semibold text-foreground mb-3">Color</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {colors.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setSelectedColor(color.id)}
                    className={`rounded-2xl border p-4 text-left transition-all ${selectedColor === color.id ? 'border-amber-600 bg-amber-50' : 'border-border/30 hover:border-amber-400/50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full border" style={{ backgroundColor: color.color_hex || '#ccc' }} />
                      <span className="text-sm font-medium text-foreground">{color.color_name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-foreground mb-3">Length</label>
              <select
                value={selectedQuantity}
                onChange={(e) => setSelectedQuantity(e.target.value)}
                className="w-full rounded-2xl border border-border/30 bg-background px-4 py-3 text-sm"
              >
                {quantities.map((qty) => (
                  <option key={qty.id} value={qty.id}>
                    {qty.length_inches}" ({qty.stock_quantity > 0 ? `${qty.stock_quantity} in stock` : 'Out of stock'})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-semibold text-foreground mb-3">Quantity</label>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-11 w-11 rounded-xl border border-border/30 hover:bg-muted text-lg shrink-0">−</button>
                <input
                  type="number"
                  min="1"
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
                disabled={processing}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <Bolt className="w-5 h-5" />
                {processing ? 'Processing...' : 'Buy Now'}
              </Button>
              <Button
                onClick={handleAddToCart}
                disabled={processing}
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
    </main>
  )
}