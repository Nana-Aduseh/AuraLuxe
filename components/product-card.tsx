import Image from 'next/image'
import { formatPrice } from '@/lib/currency'
import { Product } from '@/lib/api'

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="bg-card rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-all hover:scale-102 border border-border/30 hover:border-primary/30">
      <div className="relative h-72 bg-muted overflow-hidden group">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-foreground/40">No image</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {product.is_trending && (
          <div className="absolute top-4 right-4 bg-primary text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider">
            Trending
          </div>
        )}
        {product.is_newest && (
          <div className="absolute top-4 left-4 bg-accent text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider">
            New
          </div>
        )}
      </div>

      <div className="p-6">
        <h3 className="font-semibold text-foreground mb-2 line-clamp-2 text-lg">
          {product.name}
        </h3>
        <p className="text-sm text-foreground/70 mb-6 line-clamp-2 leading-relaxed">
          {product.description}
        </p>
        <div className="flex justify-between items-center pt-4 border-t border-border/30">
          <span className="text-3xl font-bold text-primary">
            {formatPrice(product.price)}
          </span>
          <span className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-semibold transition-all hover:bg-primary/20">
            View
          </span>
        </div>
      </div>
    </div>
  )
}
