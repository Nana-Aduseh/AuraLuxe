import Image from 'next/image';
import modelsImage from '../image/models.jpg';

export default function HeroSection() {
  return (
    <section className="relative h-screen w-full flex items-center justify-center text-center overflow-hidden">
      {/* Background Image Container */}
      <div className="absolute inset-0 z-0">
        <Image
          src={modelsImage}
          alt="AuraLuxe Models"
          fill
          priority // Loads instantly to optimize Largest Contentful Paint (LCP)
          placeholder="blur" // Leverages automatic static import blurring
          className="object-cover object-center" // Ensures models remain centered and image scales responsively
          quality={75}
        />
        {/* Semi-transparent overlay to ensure text readability */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-4xl">
        <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg tracking-tight">
          Discover True Elegance
        </h1>
        <p className="mt-4 text-lg md:text-xl text-gray-200 drop-shadow-md">
          Explore our latest collection designed for the modern aesthetic.
        </p>
        <button className="mt-8 px-8 py-3 bg-white text-black font-semibold rounded-full hover:bg-gray-100 transition-colors duration-200">
          Shop the Collection
        </button>
      </div>
    </section>
  );
}