import Image from 'next/image'
import Link from 'next/link'
import { formatPrice } from '@/lib/currency'
import { Product, getProductPricing, slugifyProductName } from '@/lib/api'

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const { hasPromo, currentPrice, originalPrice } = getProductPricing(product)

  return (
    <Link
      href={`/extensions/${slugifyProductName(product.name)}`}
      className="group block bg-card rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-all hover:scale-102 border border-border/30 hover:border-primary/30"
    >
      <div className="relative h-48 md:h-72 bg-muted overflow-hidden">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            loading="eager"
            className="object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-foreground/40">No image</span>
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
    </Link>
  )
}
