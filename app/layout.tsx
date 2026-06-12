import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Suspense } from 'react'
import './globals.css'
import SiteHeader from '@/components/site-header'
import ScrollToTop from '@/components/scroll-to-top'
import CountdownTimer from '../components/CountdownTimer'
import CompanyLogo from './image/aura luxe.png'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] }); // This line was already present, no change needed here.

export const metadata: Metadata = {
  title: 'AuraLuxe Hair | Premium Hair',
  description: 'Premium hair extensions for all hair types. Shop trending and newest collections.',
  icons: {
    icon: CompanyLogo.src,
  },
}

const salesStartDate = '2026-06-15T00:00:00Z'; // June 15, 2026, 00:00:00 GMT

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background overflow-x-hidden" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground overflow-x-hidden">
        <CountdownTimer targetDate={salesStartDate} />
        <Suspense fallback={null}>
          <ScrollToTop />
        </Suspense>
        <SiteHeader />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
        <SpeedInsights />
      </body>
    </html>
  )
}
