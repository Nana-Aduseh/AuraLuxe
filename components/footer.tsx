'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Phone, MapPin } from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border/30 bg-gradient-to-t from-primary/5 to-background mt-20">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-12 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <Image
              src="/aura-luxe-logo.png"
              alt="Aura Luxe"
              width={160}
              height={64}
              className="h-12 w-auto"
              priority
            />
            <p className="text-foreground/70 text-sm">
              Premium quality hair extensions for the modern woman.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/extensions" className="text-foreground/70 hover:text-primary transition-colors text-sm">
                  Shop Extensions
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-foreground/70 hover:text-primary transition-colors text-sm">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/cart" className="text-foreground/70 hover:text-primary transition-colors text-sm">
                  My Cart
                </Link>
              </li>
              <li>
                <Link href="/auth/login" className="text-foreground/70 hover:text-primary transition-colors text-sm">
                  Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Get In Touch</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <Phone size={16} className="text-primary flex-shrink-0" />
                <a href="tel:0542426135" className="text-foreground/70 hover:text-primary transition-colors text-sm">
                  0542426135
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <span className="text-foreground/70 text-sm">
                  Accra, Ghana
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary text-sm font-medium">TikTok:</span>
                <a
                  href="https://tiktok.com/@auraluxeextensions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/70 hover:text-primary transition-colors text-sm"
                >
                  @Aura Luxe Extensions
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/30 pt-8">
          <div className="flex justify-center items-center">
            <p className="text-foreground/60 text-sm">
              © {currentYear} Aura Luxe Extensions. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
