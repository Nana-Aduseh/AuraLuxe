"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/currency";
import { Printer } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { persistGuestOrderContext } from "@/lib/guest-orders";
import WhatsAppButton from "@/components/whatsapp-button";

export default function OrderConfirmationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(true);

  const orderId = params.orderId as string;
  const guestToken = searchParams.get("guestToken") || searchParams.get("token");

  useEffect(() => {
    let cancelled = false;

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const loadOrder = async () => {
      const fallbackToken =
        guestToken ||
        window.sessionStorage.getItem("aura-luxe-guest-order-token") ||
        window.sessionStorage.getItem("aura-luxe-pending-payment-token");

      const tokenQuery = fallbackToken ? `?token=${encodeURIComponent(fallbackToken)}` : "";

      for (let attempt = 0; attempt < 24 && !cancelled; attempt += 1) {
        try {
          const response = await fetch(
            `/api/orders/by-reference/${encodeURIComponent(orderId)}${tokenQuery}`,
            { cache: "no-store" },
          );

          if (response.ok) {
            const payload = await response.json();

            if (payload.order && payload.order.confirmation_status === "confirmed") {
              setIsConfirmingPayment(false);
              setOrder(payload.order);
              persistGuestOrderContext({
                orderId: payload.order.id,
                token: payload.order.guest_access_token || fallbackToken,
                email: payload.order.guest_email || null,
              });

              setOrderItems(Array.isArray(payload.items) ? payload.items : []);
              setLoading(false);
              return;
            }

            if (payload.verified && payload.payData) {
              const payData = payload.payData as any;
              const metadata = (payData.metadata || {}) as any;
              const cartItems = Array.isArray(metadata.cart_items) ? metadata.cart_items : [];

              const tempOrder = {
                id: metadata.checkout_reference || payData.reference,
                payment_reference: payData.reference,
                confirmation_status: "not_confirmed",
                status: "processing",
                total_amount: Number(metadata.total_amount ?? Number(payData.amount) / 100),
                guest_access_token: metadata.guest_token || fallbackToken || null,
                guest_email: metadata.guest_info?.email || null,
                created_at: payData.created_at || new Date().toISOString(),
              };

              setOrder(tempOrder);

              setOrderItems(Array.isArray(payload.items) ? payload.items : cartItems);
              setLoading(false);

              try {
                const finalizeRes = await fetch("/api/orders/finalize", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ reference: payData.reference, token: fallbackToken }),
                });

                if (finalizeRes.ok) {
                  const finalized = await finalizeRes.json();
                  if (finalized.order) {
                    setOrder(finalized.order);
                    setOrderItems(Array.isArray(finalized.items) ? finalized.items : (Array.isArray(payload.items) ? payload.items : cartItems));
                    persistGuestOrderContext({
                      orderId: finalized.order.id,
                      token: finalized.order.guest_access_token || fallbackToken,
                      email: finalized.order.guest_email || null,
                    });
                  }
                } else {
                  const err = await finalizeRes.json().catch(() => null);
                  console.error("Finalize failed:", err);
                }
              } catch (e) {
                console.error("Finalize network error:", e);
              }

              return;
            }
          }

          if (response.status !== 404) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error || "Failed to load order");
          }
        } catch (err) {
          if (!cancelled) {
            console.error("Error loading order:", err);
          }
        }

        await wait(2500);
      }

      if (!cancelled) {
        setLoadError("This order is still being verified. Please refresh in a moment.");
        setLoading(false);
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
            <h1 className="text-lg font-semibold text-gray-900">
              {isConfirmingPayment ? "Confirming payment" : "Loading order details"}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {isConfirmingPayment ? "Please wait while we verify your Paystack payment and load your order." : "Please wait while we load your order information."}
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
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Payment not completed</h1>
            <p className="text-gray-700 mb-6">{loadError}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white">
                <Link href="/checkout">Return to Checkout</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/cart">Back to Cart</Link>
              </Button>
              <a
                href={`https://wa.me/233542426135?text=${encodeURIComponent(
                  `I did not receive my Paystack verification code for reference ${orderId}. Please send it via WhatsApp instead.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 border rounded text-sm"
              >
                Receive code via WhatsApp
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
                alt="AuraLuxe Extensions"
                width={100}
                height={40}
                className="h-10 w-auto"
                style={{ width: 'auto', height: '2.5rem' }}
              />
            </div>
            <h1 className="text-lg font-bold text-gray-900">AuraLuxe Extensions</h1>
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
                orderItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-start py-1 border-b border-gray-200 last:border-0"
                  >
                    <div className="flex-1 pr-2">
                      <p className="font-medium text-gray-900">
                        {item.product?.name || item.product_id || "Unknown Product"}
                      </p>
                      <p className="text-gray-600">
                        Color: {item.color?.color_name || (item.color_id ? "Loading..." : "N/A")} | Length:{" "}
                        {item.quantity_data?.length_inches || (item.quantity_id ? "Loading..." : "N/A")}
                        " | Qty: {item.quantity_ordered ?? item.quantity ?? 0}
                      </p>
                      {!item.product && (
                        <p className="text-xs text-orange-600 mt-1">
                          ⚠ Product data unavailable (ID: {item.product_id})
                        </p>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900 whitespace-nowrap">
                      {formatPrice(
                        (item.product?.price || item.price_at_purchase || item.price || 0) *
                          (item.quantity_ordered ?? item.quantity ?? 1),
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
            <li>✓ Your hair extensions will be processed within 2-3 business days</li>
            <li>✓ You'll receive delivery updates via phone call</li>
          </ul>
        </div>
      </div>

      <WhatsAppButton message="Hi AuraLuxe Extensions, I need support for my order." />
    </main>
  );
}
