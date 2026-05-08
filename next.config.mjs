const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: supabaseHost
      ? [
          {
            protocol: 'https',
            hostname: supabaseHost,
          },
        ]
      : [],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // OneDrive on Windows can lock Webpack cache files during rename operations.
      // Keep the dev cache in memory so `next dev --webpack` stays stable.
      config.cache = {
        type: 'memory',
      }
    }

    return config
  },
}

export default nextConfig
