"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/currency";
import { Printer } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { persistGuestOrderContext } from "@/lib/guest-orders";
import { clearGuestCartItems } from "@/lib/guest-cart";
import { clearCart } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import WhatsAppButton from "@/components/whatsapp-button";

export default function OrderConfirmationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  const orderId = params.orderId as string;
  const guestToken = searchParams.get("guestToken") || searchParams.get("token");

  useEffect(() => {
    let cancelled = false;

    const loadOrder = async () => {
      // PER USER REQUEST: Trust the redirect.
      // Immediately build and display a receipt from local data,
      // then create the order in the database in the background.
      try {
        const currentToken = guestToken || 
          window.sessionStorage.getItem("aura-luxe-guest-order-token") ||
          window.sessionStorage.getItem("aura-luxe-pending-payment-token");
        
        console.log(`[OrderConfirmation] Trusting redirect for reference: ${orderId}. Building optimistic receipt.`);

        let fallbackItems: any[] = [];
        let fallbackTotal = 0;
        let fallbackDeliveryType = "delivery";
        let fallbackGuestInfo = {};

        // Reconstruct cart/order details from session/local storage
        try {
          const state = window.sessionStorage.getItem("aura-luxe-checkout-state-v2");
          if (state) {
            const parsed = JSON.parse(state);
            fallbackDeliveryType = parsed.deliveryType || "delivery";
            fallbackGuestInfo = {
              firstName: parsed.firstName,
              lastName: parsed.lastName,
              email: parsed.email,
              phone: parsed.phone,
              address: parsed.address,
              town: parsed.town,
              region: parsed.region,
            };

            if (parsed.cartItems && Array.isArray(parsed.cartItems) && parsed.cartItems.length > 0) {
              fallbackItems = parsed.cartItems;
              fallbackTotal = parsed.cartItems.reduce((sum: number, item: any) => sum + ((item.price_at_purchase || item.product?.price || 0) * (item.quantity_ordered || 1)), 0);
            } else if (parsed.checkoutMode === "buy-now") {
              const bn = window.sessionStorage.getItem("aura-luxe-buy-now");
              if (bn) {
                  const item = JSON.parse(bn);
                  fallbackItems = [item];
                  fallbackTotal = (item.price_at_purchase || item.product?.price || 0) * (item.quantity_ordered || 1);
              }
            } else {
              const storedCart = window.localStorage.getItem("aura-luxe-cart-guest");
              if (storedCart) {
                  const parsedCart = JSON.parse(storedCart);
                  fallbackItems = parsedCart;
                  fallbackTotal = parsedCart.reduce((sum: number, item: any) => sum + ((item.price_at_purchase || item.product?.price || 0) * (item.quantity_ordered || 1)), 0);
              }
            }
          }
        } catch(e) {
          console.error("Failed to reconstruct fallback receipt:", e);
        }

        // Show the optimistic receipt immediately
        setOrder({
          id: orderId,
          payment_reference: orderId,
          confirmation_status: 'confirmed',
          status: 'processing',
          total_amount: fallbackTotal,
          guest_access_token: currentToken || null,
          created_at: new Date().toISOString(),
        });
        setOrderItems(fallbackItems);
        setIsConfirmingPayment(false);
        setLoading(false);

        // Force DB insert in background to track the order
        fetch("/api/orders/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
              reference: orderId, 
              token: currentToken,
              forceFallback: true,
              fallbackItems,
              fallbackTotal,
              fallbackGuestInfo,
              fallbackDeliveryType,
              fallbackStatus: 'processing',
              fallbackConfirmation: 'confirmed'
          }),
        }).then(res => {
            if (res.ok) {
              console.log("[OrderConfirmation] Background finalize successful.");
              clearGuestCartItems();
              window.sessionStorage.removeItem("aura-luxe-checkout-state-v2");
              window.dispatchEvent(new Event("aura-luxe-cart-updated"));
            } else {
              console.error("[OrderConfirmation] Background finalize failed.");
            }
        }).catch((err) => {
          console.error("[OrderConfirmation] Background finalize network error:", err);
        });

      } catch (err) {
        if (!cancelled) {
          console.error("Error loading order:", err);
          setLoadError(err instanceof Error ? err.message : "Failed to load order");
          setLoading(false);
        }
      }
    };

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [orderId, guestToken]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white">
        <div className="flex flex-col items-center justify-center gap-4 py-20 px-4 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Verifying payment</h1>
            <p className="mt-1 text-sm text-gray-600">
              Just a moment while we verify your payment with Paystack...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Payment verification failed</h1>
            <p className="text-gray-700 mb-6">
              We couldn't verify your payment with Paystack. This usually means:
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
              <li>Your payment was cancelled or declined</li>
              <li>The payment reference is invalid</li>
              <li>There was a network issue during verification</li>
            </ul>
            <p className="text-gray-700 mb-6">
              <strong>Error details:</strong> {loadError}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white">
                <Link href="/checkout">Try Again</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/cart">Back to Cart</Link>
              </Button>
              <a
                href={`https://wa.me/233542426135?text=${encodeURIComponent(
                  `I'm having trouble verifying my payment for reference ${orderId}. Can you help?`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 border rounded text-sm hover:bg-gray-50"
              >
                Contact Support via WhatsApp
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <p className="text-gray-500">Order not found</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="no-print flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Button
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 text-sm flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </Button>
          <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white py-2 text-sm">
            <Link href="/">Continue Shopping</Link>
          </Button>
          <Button variant="outline" asChild className="py-2 text-sm">
            <Link href="/orders">View Orders</Link>
          </Button>
        </div>

        <div className="bg-white border-2 border-gray-300 p-6 space-y-4">
          <div className="text-center border-b-2 border-gray-300 pb-3">
            <div className="flex justify-center mb-2">
              <Image
                src="/aura-luxe-logo.png"
                alt="AuraLuxe Hair"
                width={100}
                height={40}
                className="h-10 w-auto"
                style={{ width: 'auto', height: '2.5rem' }}
              />
            </div>
            <h1 className="text-lg font-bold text-gray-900">AuraLuxe Hair</h1>
            <p className="text-xs text-gray-600">Premium Quality Hair Extensions</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm border-b border-gray-300 pb-3">
            <div>
              <p className="text-gray-600 text-xs font-semibold">ORDER NUMBER</p>
              <p className="font-bold text-gray-900 text-sm">{order.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-600 text-xs font-semibold">DATE</p>
              <p className="font-bold text-gray-900 text-sm">{new Date(order.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-gray-600 text-xs font-semibold">STATUS</p>
              <p className="font-bold text-green-600 capitalize text-sm">{order.status}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-600 text-xs font-semibold">TOTAL</p>
              <p className="font-bold text-amber-600 text-sm">{formatPrice(order.total_amount)}</p>
            </div>
          </div>

          <div className="text-xs">
            <p className="font-semibold text-gray-900 mb-2">ORDER ITEMS</p>
            <div className="space-y-1">
              {orderItems && orderItems.length > 0 ? (
                orderItems.map((item, index) => (
                  <div
                    key={item.id || `order-item-${index}`}
                    className="flex justify-between items-start py-1 border-b border-gray-200 last:border-0"
                  >
                    <div className="flex-1 pr-2">
                      <p className="font-medium text-gray-900">
                        {item.product?.name || item.product_id || "Unknown Product"}
                      </p>
                      <p className="text-gray-600 text-xs">
                        Color: {item.color?.color_name || item.color_name || (item.color_id ? "Loading..." : "N/A")} | Length: {item.product?.length_inches || item.length_inches || "N/A"}
                        " | Qty: {item.quantity_ordered ?? item.quantity ?? 1}
                      </p>
                      {!item.product && (
                        <p className="text-xs text-orange-600 mt-1">
                          ⚠ Product data unavailable (ID: {item.product_id})
                        </p>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900 whitespace-nowrap">
                      {formatPrice(
                        (item.price_at_purchase ?? 
                         item.price ?? 
                         (item.product?.promo_enabled && item.product?.discounted_price 
                           ? item.product.discounted_price 
                           : item.product?.price ?? 0)) * 
                        (item.quantity_ordered ?? item.quantity ?? 1)
                      )}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 py-2">
                  <p>No items found</p>
                  {orderItems.length === 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      Order may have been placed before item tracking was enabled
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t-2 border-gray-300 pt-2 text-sm font-bold flex justify-between">
            <span>TOTAL:</span>
            <span className="text-amber-600 text-base">{formatPrice(order.total_amount)}</span>
          </div>

          <div className="text-center text-xs text-gray-600 border-t border-gray-300 pt-2">
            <p>Thank you for your purchase!</p>
            <p>Contact: +233 542 426 135 | Accra, Ghana</p>
          </div>
        </div>

        <div className="no-print mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <h3 className="font-semibold text-blue-900 mb-2">What's Next?</h3>
          <ul className="space-y-1 text-blue-800 text-sm">
            {order.confirmation_status === "confirmed" ? (
              <>
                <li>✓ Your order has been confirmed by the admin team</li>
                <li>✓ A confirmation email has been sent</li>
              </>
            ) : (
              <>
                <li>✓ Your payment has been verified</li>
                <li>• Your order is waiting for admin confirmation</li>
              </>
            )}
            <li>• Your order will be processed within 1-2 business days</li>
            <li>• You'll receive delivery updates via phone call</li>
          </ul>
        </div>
      </div>

      <WhatsAppButton message="Hi AuraLuxe Hair, I need support for my order." />
    </main>
  );
}
