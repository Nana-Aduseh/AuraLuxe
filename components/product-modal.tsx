'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/currency'
import { X, ShoppingCart, Zap } from 'lucide-react'
import { Product, ProductColor, ProductQuantity, addToCart } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'

interface ProductModalProps {
  product: Product
  colors: ProductColor[]
  quantities: ProductQuantity[]
  onClose: () => void
  onAddedToCart?: () => void
}

export default function ProductModal({
  product,
  colors,
  quantities,
  onClose,
  onAddedToCart,
}: ProductModalProps) {
  const router = useRouter()
  const [selectedColor, setSelectedColor] = useState<string>(
    colors[0]?.id || ''
  )
  const [selectedQuantity, setSelectedQuantity] = useState<string>(
    quantities[0]?.id || ''
  )
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleAddToCart = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/auth/login'
      return
    }

    // Check stock availability
    const selectedQtyData = quantities.find((q) => q.id === selectedQuantity)
    const availableStock = selectedQtyData?.stock_quantity || 0

    if (quantity > availableStock) {
      alert(`Sorry, only ${availableStock} ${availableStock === 1 ? 'piece' : 'pieces'} available for this selection.`)
      return
    }

    setLoading(true)
    try {
      await addToCart(user.id, product.id, selectedColor, selectedQuantity, quantity)
      onAddedToCart?.()
      onClose()
    } catch (error) {
      console.error('Error adding to cart:', error)
      alert('Failed to add to cart. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleBuyNow = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/auth/login'
      return
    }

    // Check stock availability
    const selectedQtyData = quantities.find((q) => q.id === selectedQuantity)
    const availableStock = selectedQtyData?.stock_quantity || 0

    if (quantity > availableStock) {
      alert(`Sorry, only ${availableStock} ${availableStock === 1 ? 'piece' : 'pieces'} available for this selection.`)
      return
    }

    setLoading(true)
    try {
      await addToCart(user.id, product.id, selectedColor, selectedQuantity, quantity)
      onClose()
      router.push('/checkout')
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to proceed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const selectedQtyData = quantities.find((q) => q.id === selectedQuantity)
  const selectedColorData = colors.find((c) => c.id === selectedColor)
  const displayImageUrl = selectedColorData?.image_url || product.image_url

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">{product.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Image */}
            <div className="h-96 bg-gray-200 rounded-lg overflow-hidden">
              {displayImageUrl ? (
                <Image
                  src={displayImageUrl}
                  alt={selectedColorData?.color_name ? `${product.name} - ${selectedColorData.color_name}` : product.name}
                  width={400}
                  height={400}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-300">
                  <span className="text-gray-500">No image</span>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex flex-col">
              <div className="mb-6">
                <p className="text-gray-600 mb-4">{product.description}</p>
                
                {/* Simplified Price Display */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <div className="text-sm text-gray-600 mb-2">
                    Price: {formatPrice(product.price)} × {quantity} {quantity === 1 ? 'piece' : 'pieces'}
                  </div>
                  <div className="text-3xl font-bold text-amber-700">
                    {formatPrice(product.price * quantity)}
                  </div>
                </div>
              </div>

              {/* Color Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Color
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {colors.map((color) => (
                    <button
                      key={color.id}
                      onClick={() => setSelectedColor(color.id)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        selectedColor === color.id
                          ? 'border-amber-600 bg-amber-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full border"
                          style={{
                            backgroundColor: color.color_hex || '#ccc',
                          }}
                        />
                        <span className="text-sm text-gray-700">
                          {color.color_name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Length/Quantity Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Length
                </label>
                <select
                  value={selectedQuantity}
                  onChange={(e) => setSelectedQuantity(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                >
                  {quantities.map((qty) => (
                    <option key={qty.id} value={qty.id}>
                      {qty.length_inches}
                      {'"'} ({qty.stock_quantity} in stock)
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Quantity
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 border border-gray-200 rounded-lg hover:bg-gray-100"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    min="1"
                    max={selectedQtyData?.stock_quantity}
                    className="w-16 text-center border border-gray-200 rounded-lg py-2"
                  />
                  <button
                    onClick={() =>
                      setQuantity(
                        Math.min(
                          quantity + 1,
                          selectedQtyData?.stock_quantity || 999
                        )
                      )
                    }
                    className="w-10 h-10 border border-gray-200 rounded-lg hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Info */}
              {selectedQtyData && (
                <div className="mb-6 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Length: {selectedQtyData.length_inches}"
                  </p>
                  <p className="text-sm text-gray-600">
                    In Stock: {selectedQtyData.stock_quantity} pieces
                  </p>
                  {selectedQtyData.stock_quantity < 10 && selectedQtyData.stock_quantity > 0 && (
                    <p className="text-sm text-orange-600 font-semibold mt-2">
                      ⚠️ Only {selectedQtyData.stock_quantity} left in stock!
                    </p>
                  )}
                  {selectedQtyData.stock_quantity === 0 && (
                    <p className="text-sm text-red-600 font-semibold mt-2">
                      Out of stock
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleBuyNow}
                  disabled={loading || !selectedQtyData?.stock_quantity}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Zap className="w-5 h-5" />
                  {loading ? 'Processing...' : 'Buy Now'}
                </Button>
                <Button
                  onClick={handleAddToCart}
                  disabled={loading || !selectedQtyData?.stock_quantity}
                  variant="outline"
                  className="w-full py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {loading ? 'Adding...' : 'Add to Cart'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
