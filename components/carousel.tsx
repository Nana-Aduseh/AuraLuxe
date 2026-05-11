'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ProductCard from './product-card'
import { Product } from '@/lib/api'

interface CarouselProps {
  products: Product[]
  title: string
  onProductClick: (product: Product) => void
  onTitleClick?: () => void
}

export default function Carousel({
  products,
  title,
  onProductClick,
  onTitleClick,
}: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [autoPlay, setAutoPlay] = useState(true)
  const [isSmallDevice, setIsSmallDevice] = useState(false)

  useEffect(() => {
    const checkScreenSize = () => {
      // Show 2 items only on very small screens (mobile), 3 items on everything else
      setIsSmallDevice(window.innerWidth < 768) // Mobile: < 768px
    }
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  useEffect(() => {
    if (!autoPlay) return

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % products.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [autoPlay, products.length])

  const handlePrev = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? products.length - 1 : prev - 1
    )
    setAutoPlay(false)
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % products.length)
    setAutoPlay(false)
  }

  if (products.length === 0) return null

  // Show 3 items on all tablets and larger, 2 items only on mobile
  let itemsToShow = 3 // default for tablet and above
  if (isSmallDevice) {
    itemsToShow = 2 // mobile only
  }
  
  const visibleProducts = Array.from({ length: itemsToShow }, (_, i) =>
    products[(currentIndex + i) % products.length]
  )

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-primary/5 via-background to-accent/5 border-y border-border/30">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <h2 
            className={`text-3xl md:text-4xl font-bold text-foreground ${onTitleClick ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
            onClick={onTitleClick}
          >
            {title}
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrev}
              aria-label="Previous"
              className="hover:bg-primary/10 hover:border-primary/30"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              aria-label="Next"
              className="hover:bg-primary/10 hover:border-primary/30"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
          {visibleProducts.map((product, index) => (
            <div
              key={`${product.id}-${index}`}
              onClick={() => onProductClick(product)}
              className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>

        {/* Indicator dots */}
        <div className="flex justify-center gap-3 mt-10">
          {products.map((_, index) => (
            <button
              key={index}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                index === currentIndex ? 'bg-primary w-8' : 'bg-primary/30 hover:bg-primary/50'
              }`}
              onClick={() => {
                setCurrentIndex(index)
                setAutoPlay(false)
              }}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
