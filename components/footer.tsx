'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Phone, MapPin } from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border/30 bg-primary text-primary-foreground mt-20">
      <div className="max-w-7xl mx-auto px-6 pt-0 pb-0">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-1 mb-0">
          {/* Brand */}
          <div className="space-y-0.5 md:flex-shrink-0 md:mr-auto md:mb-0">
            <Image
              src="/aura-luxe-logo.png"
              alt="Aura Luxe"
              width={800}
              height={320}
              className="h-16 w-auto"
              priority
            />
            <p className="text-primary-foreground/80 text-xs leading-tight">
              Premium quality hair extensions for the modern woman.
            </p>
          </div>

          {/* Quick Links */}
          <div className="md:flex-1 md:text-center md:mb-0 hidden sm:block">
            <h4 className="font-semibold text-primary-foreground mb-0.5 text-xs">Quick Links</h4>
            <ul className="space-y-0">
              <li>
                <Link href="/extensions" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors text-xs">
                  Shop Extensions
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors text-xs">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/cart" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors text-xs">
                  My Cart
                </Link>
              </li>
              <li>
                <Link href="/auth/login" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors text-xs">
                  Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="md:flex-1 md:text-center md:mb-0 hidden sm:block">
            <h4 className="font-semibold text-primary-foreground mb-0.5 text-xs">Get In Touch</h4>
            <ul className="space-y-0">
              <li className="flex items-center gap-1">
                <Phone size={12} className="text-primary-foreground flex-shrink-0" />
                <a href="tel:0542426135" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors text-xs">
                  0542426135
                </a>
              </li>
              <li className="flex items-start gap-1">
                <MapPin size={12} className="text-primary-foreground flex-shrink-0 mt-0" />
                <span className="text-primary-foreground/80 text-xs">
                  Accra, Ghana
                </span>
              </li>
              <li className="flex items-center gap-1 hidden">
                <span className="text-primary-foreground text-xs font-medium">TikTok:</span>
                <a
                  href="https://tiktok.com/@auraluxeextensions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-foreground/80 hover:text-primary-foreground transition-colors text-sm"
                >
                  @Aura Luxe Extensions
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-primary-foreground/20 pt-0.5 pb-0">
          <div className="flex justify-center items-center">
            <p className="text-primary-foreground/60 text-xs">
              © {currentYear} Aura Luxe Extensions. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
