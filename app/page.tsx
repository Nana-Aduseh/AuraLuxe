'use client'

import { useState, useEffect } from 'react'
import Carousel from '@/components/carousel'
import {
  getProducts,
  getTrendingProducts,
  getNewestProducts,
  searchProducts,
  Product,
} from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import ProductCard from '@/components/product-card'
import Footer from '@/components/footer'
import { Input } from '@/components/ui/input'
import WhatsAppButton from '@/components/whatsapp-button'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([])
  const [newestProducts, setNewestProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [userName, setUserName] = useState<string | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        await fetch('/api/profile/sync', {
          method: 'POST',
        })

        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single()

        if (profile?.name) {
          const firstName = profile.name.split(' ')[0]
          setUserName(firstName)
        }
      } else {
        setUserName(null)
      }
    }

    getUser()

    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      getUser()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const loadProducts = async () => {
      const [all, trending, newest] = await Promise.all([
        getProducts(),
        getTrendingProducts(),
        getNewestProducts(),
      ])

      setAllProducts(all)
      setTrendingProducts(trending)
      setNewestProducts(newest)
    }

    loadProducts()
  }, [])

  useEffect(() => {
    if (searchQuery.trim()) {
      const search = async () => {
        const results = await searchProducts(searchQuery)
        setSearchResults(results)
      }
      search()
    } else {
      setSearchResults([])
    }
  }, [searchQuery])

  const handleAllExtensionsClick = () => {
    router.push('/extensions')
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/20 via-background to-accent/20 px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="max-w-7xl mx-auto text-center">
          {userName ? (
            <h1 className="text-5xl sm:text-6xl font-bold text-foreground mb-6 text-balance">
              Hello, {userName}! ✨
            </h1>
          ) : (
            <h1 className="text-5xl sm:text-6xl font-bold text-foreground mb-6 text-balance">
              Luxury Hair Reimagined
            </h1>
          )}
          <p className="text-xl text-foreground/70 mb-10 text-balance">
            Transform your look with premium, 100% virgin hair extensions
          </p>
          <div className="max-w-md mx-auto">
            <Input
              type="text"
              placeholder="Search extensions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-3"
            />
          </div>
        </div>
      </section>

      {/* Search Results Section - Shows at top when searching */}
      {searchQuery.trim() && (
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-background">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-12">
              <div>
                <h2 className="text-4xl font-bold text-foreground mb-2">
                  Search Results
                </h2>
                <p className="text-foreground/70">
                  Found {searchResults.length} results for &quot;{searchQuery}&quot;
                </p>
              </div>
            </div>

            {searchResults.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {searchResults.map((product) => (
                  <div key={product.id}>
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-foreground/60 text-lg">
                  No products found. Try a different search.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Trending Section - Hidden when searching */}
      {!searchQuery.trim() && trendingProducts.length > 0 && (
        <Carousel
          products={trendingProducts}
          title="Trending Now"
        />
      )}

      {/* Newest Section - Hidden when searching */}
      {!searchQuery.trim() && newestProducts.length > 0 && (
        <Carousel
          products={newestProducts}
          title="New Arrivals"
        />
      )}

      {/* All Products Carousel - Hidden when searching */}
      {!searchQuery.trim() && allProducts.length > 0 && (
        <Carousel
          products={allProducts}
          title="All Extensions"
          onTitleClick={handleAllExtensionsClick}
        />
      )}

      <WhatsAppButton message="Hi AuraLuxe Extensions, I want to place an order." />

      <Footer />
    </main>
  )
}
