'use client'

import { useState, useEffect } from 'react'
import Carousel from '@/components/carousel'
import {
  getProductsByType,
  getTrendingProducts,
  searchProducts,
  Product,
} from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import ProductCard from '@/components/product-card'
import Footer from '@/components/footer'
import { Input } from '@/components/ui/input'
import WhatsAppButton from '@/components/whatsapp-button'
import { useRouter } from 'next/navigation'
import Image, { getImageProps } from 'next/image'
import modelsImage from './image/models.jpg'
import modelsWideImage from './image/models-wide.jpg'

export default function Home() {
  const router = useRouter()
  const [extensionProducts, setExtensionProducts] = useState<Product[]>([])
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([])
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([])
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
      const [extensions, products, trending] = await Promise.all([
        getProductsByType('extension'),
        getProductsByType('product'),
        getTrendingProducts(),
      ])

      setExtensionProducts(extensions)
      setCatalogProducts(products)
      setTrendingProducts(trending)
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

  // Art Direction: Define different images for different screen sizes
  const common = { alt: 'AuraLuxe Models', fill: true, priority: true, quality: 75 }
  const { props: { srcSet: desktop } } = getImageProps({ ...common, src: modelsWideImage })
  const { props: { srcSet: mobile, ...rest } } = getImageProps({ ...common, src: modelsImage })

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative w-full flex items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-8 py-32 md:py-48 min-h-[70vh] md:min-h-[85vh]">
        {/* Background Image Container */}
        <div className="absolute inset-0 z-0">
          <picture>
            <source media="(min-width: 1024px)" srcSet={desktop} />
            <source media="(min-width: 0px)" srcSet={mobile} />
            <img 
              {...rest} 
              className="object-cover object-top w-full h-full" 
              alt="AuraLuxe Models"
            />
          </picture>
          {/* Gradient overlay to tint the image and ensure text readability */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/60 via-background/60 to-accent/60" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto text-center w-full">
          {userName ? (
            <h1 className="text-5xl sm:text-7xl font-bold text-[#3c2933] drop-shadow-lg mb-6 text-balance tracking-tight">
              Hello, {userName}! ✨
            </h1>
          ) : (
            <h1 className="text-5xl sm:text-7xl font-bold text-[#3c2933] drop-shadow-lg mb-6 text-balance tracking-tight">
              Luxury Hair Reimagined
            </h1>
          )}
          <p className="text-xl md:text-2xl text-[#3c2933] drop-shadow-md mb-10 text-balance">
            Transform your look with premium, 100% virgin hair extensions
          </p>
          <div className="max-w-md mx-auto">
            <Input
              type="text"
              placeholder="Search extensions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-6 text-base rounded-full shadow-2xl bg-white/95 text-black placeholder:text-gray-500 border-0 focus-visible:ring-2 focus-visible:ring-primary/50"
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
          basePath="/extensions"
        />
      )}

      {/* Products Section - Hidden when searching */}
      {!searchQuery.trim() && catalogProducts.length > 0 && (
        <Carousel
          products={catalogProducts}
          title="Products"
          basePath="/products"
        />
      )}

      {/* All Products Carousel - Hidden when searching */}
      {!searchQuery.trim() && extensionProducts.length > 0 && (
        <Carousel
          products={extensionProducts}
          title="All Extensions"
          onTitleClick={handleAllExtensionsClick}
          basePath="/extensions"
        />
      )}

      <WhatsAppButton message="Hi AuraLuxe Hair, I want to place an order." />

      <Footer />
    </main>
  )
}
