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
      try {
        // Get token from URL or session
        const currentToken = guestToken || 
          window.sessionStorage.getItem("aura-luxe-guest-order-token") ||
          window.sessionStorage.getItem("aura-luxe-pending-payment-token");
        
        const tokenQuery = currentToken ? `?token=${encodeURIComponent(currentToken)}` : "";

        console.log(`[OrderConfirmation] Loading order for reference: ${orderId}`);

        // Single API call - no polling
        const response = await fetch(
          `/api/orders/by-reference/${encodeURIComponent(orderId)}${tokenQuery}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          if (payload?.payData?.status) {
            setPaymentStatus(payload.payData.status);
            throw new Error(`Your payment was ${payload.payData.status}.`);
          }
          throw new Error(payload?.error || "Failed to load order");
        }

        const payload = await response.json();

        // Case 1: Order already exists in database
        if (payload.order) {
          console.log(`[OrderConfirmation] Found order in database:`, { orderId: payload.order.id });
          setIsConfirmingPayment(false);
          setOrder(payload.order);
          persistGuestOrderContext({
            orderId: payload.order.id,
            token: payload.order.guest_access_token || currentToken,
            email: payload.order.guest_email || null,
          });
          setOrderItems(Array.isArray(payload.items) ? payload.items : []);
          setLoading(false);
          return;
        }

        // Case 2: Payment verified by Paystack but order not yet in database
        if (payload.verified && payload.payData) {
          const payData = payload.payData as any;
          const metadata = (payData.metadata || {}) as any;
          const cartItems = Array.isArray(metadata.cart_items) ? metadata.cart_items : [];

          console.log(`[OrderConfirmation] Payment verified with Paystack, showing receipt immediately`);

          // Show receipt immediately - payment is confirmed by Paystack
          const tempOrder = {
            id: metadata.checkout_reference || payData.reference,
            payment_reference: payData.reference,
            confirmation_status: "confirmed",
            status: "processing",
            total_amount: Number(metadata.total_amount ?? Number(payData.amount) / 100),
            guest_access_token: metadata.guest_token || currentToken || null,
            guest_email: metadata.guest_info?.email || null,
            created_at: payData.created_at || new Date().toISOString(),
          };

          setOrder(tempOrder);
          setOrderItems(Array.isArray(payload.items) ? payload.items : cartItems);
          setIsConfirmingPayment(false);
          setLoading(false);

          // Finalize in background - don't block the receipt display
          console.log(`[OrderConfirmation] Finalizing order in background for reference: ${payData.reference}`);
          try {
            const finalizeRes = await fetch("/api/orders/finalize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reference: payData.reference, token: currentToken }),
            });

            if (finalizeRes.ok) {
              const finalized = await finalizeRes.json();
              if (finalized.order) {
                console.log(`[OrderConfirmation] Order finalized in background:`, {
                  orderId: finalized.order.id,
                  confirmationStatus: finalized.order.confirmation_status,
                });
                // Update with finalized order details
                setOrder(finalized.order);
                setOrderItems(Array.isArray(finalized.items) ? finalized.items : cartItems);
                persistGuestOrderContext({
                  orderId: finalized.order.id,
                  token: finalized.order.guest_access_token || currentToken,
                  email: finalized.order.guest_email || null,
                });

                // Clear cart after successful order finalization
                if (finalized.order.user_id) {
                  await clearCart(finalized.order.user_id).catch(() => null);
                } else {
                  clearGuestCartItems();
                }
                window.sessionStorage.removeItem("aura-luxe-checkout-state-v2");
                window.dispatchEvent(new Event("aura-luxe-cart-updated"));
              }
            } else {
              const err = await finalizeRes.json().catch(() => null);
              console.error("Finalize failed (non-blocking):", err);
              // Don't block receipt display even if finalize fails
            }
          } catch (e) {
            console.error("Finalize network error (non-blocking):", e);
            // Don't block receipt display even if finalize errors
          }
          return;
        }

        // Case 3: No order found anywhere
        console.log(`[OrderConfirmation] Order not found in database or Paystack`);
        setLoadError("Payment could not be verified. Your payment may have been cancelled or failed. Please check with support.");
        setLoading(false);
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
    if (paymentStatus === 'abandoned' || paymentStatus === 'failed') {
      return (
        <main className="min-h-screen bg-white">
          <div className="max-w-2xl mx-auto px-4 py-16 text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8">
              <h1 className="text-2xl font-bold text-red-900 mb-3">Payment {paymentStatus === 'abandoned' ? 'Cancelled' : 'Failed'}</h1>
              <p className="text-red-700 mb-8">
                It looks like you {paymentStatus === 'abandoned' ? 'cancelled the payment before completing it' : 'had an issue completing the payment'}. You have not been charged.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white px-8">
                  <Link href="/checkout">Return to Checkout</Link>
                </Button>
                <Button asChild variant="outline" className="px-8">
                  <Link href="/cart">Back to Cart</Link>
                </Button>
              </div>
            </div>
          </div>
        </main>
      );
    }

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
