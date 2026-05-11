'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  getProducts,
  getProductDetails,
  Product,
  ProductColor,
  ProductQuantity,
} from '@/lib/api'
import ProductCard from '@/components/product-card'
import ProductModal from '@/components/product-modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'

export default function ExtensionsPageClient() {
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get('search') || ''
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(searchQuery)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productDetails, setProductDetails] = useState<{
    colors: ProductColor[]
    quantities: ProductQuantity[]
  } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    setSearchTerm(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await getProducts()
        setProducts(data)
        setFilteredProducts(data)
      } catch (error) {
        console.error('Failed to load products:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [])

  useEffect(() => {
    const filtered = products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredProducts(filtered)
  }, [searchTerm, products])

  const handleProductClick = async (product: Product) => {
    try {
      const details = await getProductDetails(product.id)
      if (details) {
        setSelectedProduct(details.product)
        setProductDetails({
          colors: details.colors,
          quantities: details.quantities,
        })
        setIsModalOpen(true)
      }
    } catch (error) {
      console.error('Failed to load product details:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
            All Extensions
          </h1>
          <p className="text-lg text-foreground/70">
            Explore our complete collection of premium hair extensions
          </p>
        </div>

        <div className="mb-12">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40 size-5" />
            <Input
              type="text"
              placeholder="Search extensions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-4 py-3 text-base"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-96 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                {filteredProducts.map((product) => (
                  <div key={product.id} onClick={() => handleProductClick(product)}>
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-xl text-foreground/60 mb-4">
                  {searchTerm
                    ? 'No extensions found matching your search'
                    : 'No extensions available'}
                </p>
                {searchTerm && (
                  <Button
                    variant="outline"
                    onClick={() => setSearchTerm('')}
                  >
                    Clear Search
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {selectedProduct && productDetails && isModalOpen && (
        <ProductModal
          product={selectedProduct}
          colors={productDetails.colors}
          quantities={productDetails.quantities}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedProduct(null)
            setProductDetails(null)
          }}
        />
      )}
    </div>
  )
}
