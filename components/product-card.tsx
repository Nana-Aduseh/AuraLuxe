'use client'

import Image from 'next/image'
import Link, { useLinkStatus } from 'next/link'
import { ViewTransition } from 'react'
import { formatPrice } from '@/lib/currency'
import { Product, getProductPricing, slugifyProductName } from '@/lib/api'
import { Loader2 } from 'lucide-react'

interface ProductCardProps {
  product: Product
  basePath?: "/extensions" | "/products"
  transitionPrefix?: string
}

/**
 * CardInner is a sub-component to access useLinkStatus context.
 * This provides an immediate visual response (dimming + spinner) the moment a user clicks.
 */
function CardInner({ product, hasPromo, originalPrice, currentPrice, transitionPrefix }: any) {
  const { pending } = useLinkStatus()

  return (
    <div className={`relative transition-all duration-300 ${pending ? 'opacity-60 scale-[0.98] grayscale-[0.3]' : ''}`}>
      <div className="relative h-48 md:h-72 bg-muted overflow-hidden">
        {product.image_url ? (
          <ViewTransition name={`${transitionPrefix ? `${transitionPrefix}-` : ''}product-image-${product.id}`}>
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              loading="lazy"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover group-hover:scale-110 transition-transform duration-300"
            />
          </ViewTransition>
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-foreground/40">No image</span>
          </div>
        )}
        
        {/* Immediate loading feedback */}
        {pending && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/10 backdrop-blur-[2px] z-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="p-3 md:p-6">
        <h3 className="font-semibold text-foreground mb-1 md:mb-2 line-clamp-2 text-sm md:text-lg">
          {product.name}
        </h3>
        <p className="text-xs md:text-sm text-foreground/70 mb-3 md:mb-6 line-clamp-2 leading-relaxed">
          {product.description}
        </p>
        <div className="flex justify-between items-end gap-3 pt-2 md:pt-4 border-t border-border/30">
          <div className="flex flex-col">
            {hasPromo && originalPrice ? (
              <span className="text-xs md:text-sm text-foreground/50 line-through">
                {formatPrice(originalPrice)}
              </span>
            ) : null}
            <span className="text-base md:text-2xl font-bold text-primary">
              {formatPrice(currentPrice)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProductCard({ product, basePath, transitionPrefix }: ProductCardProps) {
  const { hasPromo, currentPrice, originalPrice } = getProductPricing(product)
  const productBasePath = basePath || (product.product_type === "product" ? "/products" : "/extensions")

  return (
    <Link
      href={`${productBasePath}/${slugifyProductName(product.name)}`}
      className="group block bg-card rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-all hover:scale-102 border border-border/30 hover:border-primary/30"
      transitionTypes={['nav-forward']}
    >
      <CardInner 
        product={product} 
        hasPromo={hasPromo} 
        originalPrice={originalPrice} 
        currentPrice={currentPrice} 
        transitionPrefix={transitionPrefix}
      />
    </Link>
  )
}
