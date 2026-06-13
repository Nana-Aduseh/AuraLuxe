import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Skeleton */}
      <div className="relative w-full h-[70vh] md:h-[85vh] bg-muted animate-pulse flex items-center justify-center">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-64 mx-auto" />
          <Skeleton className="h-6 w-96 mx-auto" />
          <Skeleton className="h-12 w-48 mx-auto rounded-full" />
        </div>
      </div>

      {/* Carousel Skeletons */}
      <div className="max-w-7xl mx-auto px-4 py-16 space-y-20">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-10">
            <div className="flex justify-between items-center">
              <Skeleton className="h-10 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-10 rounded-md" />
                <Skeleton className="h-10 w-10 rounded-md" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((j) => (
                <div key={j} className="space-y-4">
                  <Skeleton className="h-72 w-full rounded-xl" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}