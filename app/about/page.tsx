'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Heart, Sparkles, Award } from 'lucide-react'
import modelsImage from '../image/models1.jpg'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5">
      {/* Hero Section */}
      <div className="border-b border-border/30">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-32">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-12">
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 text-balance">
                About AuraLuxe Extensions
              </h1>
              <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
                We believe every woman deserves to feel confident and beautiful. AuraLuxe Extensions is dedicated to providing premium quality hair extensions that transform your look and boost your confidence.
              </p>
              <Link href="/extensions">
                <Button size="lg" className="bg-primary hover:bg-primary/90">
                  Shop Our Collection
                </Button>
              </Link>
            </div>
            <div className="flex-1">
              <div className="relative h-80 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20">
                <Image
                  src={modelsImage}
                  alt="AuraLuxe Models"
                  fill
                  className="object-cover object-top"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Values Section */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-12 text-center">
          Our Values
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-card rounded-xl p-8 border border-border/30 hover:border-primary/50 transition-colors">
            <Heart className="size-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-3">Premium Quality</h3>
            <p className="text-foreground/70">
              We source only the finest 100% virgin hair from trusted suppliers worldwide. Every bundle is carefully crafted to ensure longevity and beauty.
            </p>
          </div>
          <div className="bg-card rounded-xl p-8 border border-border/30 hover:border-primary/50 transition-colors">
            <Award className="size-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-3">Expert Craftsmanship</h3>
            <p className="text-foreground/70">
              Our team has years of experience in hair extensions. We work with the latest techniques to deliver products that look and feel natural.
            </p>
          </div>
          <div className="bg-card rounded-xl p-8 border border-border/30 hover:border-primary/50 transition-colors">
            <Sparkles className="size-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-3">Customer Excellence</h3>
            <p className="text-foreground/70">
              Your satisfaction is our priority. We provide dedicated customer support and care instructions to help you maintain your beautiful hair.
            </p>
          </div>
        </div>
      </div>

      {/* Story Section */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 border-y border-border/30">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            Our Story
          </h2>
          <div className="space-y-4 text-lg text-foreground/70 leading-relaxed">
            <p>
              AuraLuxe Extensions was founded with a simple mission: to bring luxury hair extensions to everyone. We noticed a gap in the market for high-quality, authentic hair products at reasonable prices.
            </p>
            <p>
              What started as a passion project has grown into a trusted brand serving thousands of satisfied customers across the region. We&apos;re committed to maintaining the highest standards while keeping our products accessible and affordable.
            </p>
            <p>
              Every product we sell carries our commitment to excellence. We invest in sourcing the best materials, training our team, and listening to our customers to continuously improve what we offer.
            </p>
          </div>
        </div>
      </div>

      {/* Why Choose Us */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-12 text-center">
          Why Choose AuraLuxe
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          {[
            { title: '100% Virgin Hair', desc: 'Authentic, unprocessed hair that lasts longer and looks more natural' },
            { title: 'Multiple Textures', desc: 'Straight, wavy, curly, and coily options for every hair type' },
            { title: 'Affordable Luxury', desc: 'Premium quality without the premium price tag' },
            { title: 'Expert Support', desc: 'Guidance on installation, styling, and maintenance' },
            { title: 'Secure Checkout', desc: 'Safe and easy payment process with multiple options' },
            { title: 'Fast Delivery', desc: 'Quick processing and shipping to your doorstep' },
          ].map((item, i) => (
            <div key={i} className="flex gap-4 p-6 rounded-lg border border-border/30 hover:border-primary/30 transition-colors">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary font-semibold">
                  ✓
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="text-foreground/70 mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-primary/90 to-accent/80 rounded-2xl mx-6 mb-20">
        <div className="max-w-4xl mx-auto px-8 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Look?
          </h2>
          <p className="text-white/90 text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied customers who have discovered the confidence that comes with AuraLuxe Extensions.
          </p>
          <Link href="/extensions">
            <Button size="lg" className="bg-white text-primary hover:bg-white/90">
              Shop Now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
