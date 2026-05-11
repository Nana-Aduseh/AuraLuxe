import { Suspense } from 'react'
import ExtensionsPageClient from './page-client'

function ExtensionsPageFallback() {
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6 lg:gap-8">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="h-96 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ExtensionsPage() {
  return (
    <Suspense fallback={<ExtensionsPageFallback />}>
      <ExtensionsPageClient />
    </Suspense>
  )
}
