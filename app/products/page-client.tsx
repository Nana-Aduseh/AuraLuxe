'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  getProductsByType,
  Product,
} from '@/lib/api'
import ProductCard from '@/components/product-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'

export default function ProductsPageClient() {
  const searchParams = useSearchParams()
  const searchQuery = searchParams.get('search') || ''
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(searchQuery)

  useEffect(() => {
    setSearchTerm(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await getProductsByType('product')
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
            Hair Products
          </h1>
          <p className="text-lg text-foreground/70">
            Shop oils, care essentials, and treatment products
          </p>
        </div>

        <div className="mb-12">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40 size-5" />
            <Input
              type="text"
              placeholder="Search products..."
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-96 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
                {filteredProducts.map((product) => (
                  <div key={product.id}>
                    <ProductCard product={product} basePath="/products" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-xl text-foreground/60 mb-4">
                  {searchTerm
                    ? 'No products found matching your search'
                    : 'No products available'}
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
    </div>
  )
}
