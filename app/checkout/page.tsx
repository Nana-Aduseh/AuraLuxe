"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/currency";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getCart, CartItem, getEffectiveProductPrice } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { persistGuestOrderContext } from "@/lib/guest-orders";
import WhatsAppButton from "@/components/whatsapp-button";
import {
  clearGuestBuyNowItem,
  clearGuestCartItems,
  clearGuestCheckoutDraft,
  getGuestBuyNowItem,
  getGuestCartItems,
  getGuestCheckoutDraft,
  saveGuestCheckoutDraft,
} from "@/lib/guest-cart";

const GHANA_REGIONS = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North",
];

export default function CheckoutPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [checkoutChoice, setCheckoutChoice] = useState<"guest" | "account">("guest");
  const [isGuestFlow, setIsGuestFlow] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">(
    "delivery",
  );
  const [checkoutMode, setCheckoutMode] = useState<"cart" | "buy-now" | "guest">("cart");
  const router = useRouter();
  const supabase = createClient();

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [town, setTown] = useState("");
  const [region, setRegion] = useState("");
  const [phone, setPhone] = useState("");

  const syncGuestDraftToUser = async (currentUserId: string) => {
    const guestDraft = getGuestCheckoutDraft();

    if (!guestDraft) {
      return;
    }

    await supabase.from("user_addresses").upsert({
      user_id: currentUserId,
      first_name: guestDraft.firstName,
      last_name: guestDraft.lastName,
      email: guestDraft.email,
      address: guestDraft.address,
      town: guestDraft.town,
      region: guestDraft.region,
      phone: guestDraft.phone,
    });

    await fetch("/api/profile/sync", { method: "POST" }).catch(() => null);
    clearGuestCheckoutDraft();
  };

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);

      if (user) {
        setEmail(user.email || "");
        setCheckoutChoice("account");
      } else {
        setEmail("");
        setCheckoutChoice("guest");
      }

      const urlMode = new URLSearchParams(window.location.search).get("mode");
      const storedMode = window.sessionStorage.getItem(
        "aura-luxe-checkout-mode",
      );
      const mode =
        urlMode === "buy-now"
          ? "buy-now"
          : urlMode === "guest" || storedMode === "guest"
            ? "guest"
            : storedMode === "buy-now"
              ? "buy-now"
              : "cart";

      setCheckoutMode(mode);

      if (user && getGuestCheckoutDraft()) {
        await syncGuestDraftToUser(user.id);
      }

      if (mode === "buy-now") {
        const savedBuyNowItem =
          window.sessionStorage.getItem("aura-luxe-buy-now");

        if (!savedBuyNowItem) {
          const guestBuyNowItem = getGuestBuyNowItem();

          if (!guestBuyNowItem) {
            router.push("/cart");
            return;
          }

          setCartItems([guestBuyNowItem]);
          setIsGuestFlow(!user);
          setLoading(false);
          return;
        }

        try {
          const parsedItem = JSON.parse(savedBuyNowItem);
          setCartItems([parsedItem]);
          setIsGuestFlow(false);
        } catch {
          router.push("/cart");
          return;
        }
      } else if (mode === "guest") {
        const guestItems = getGuestCartItems();

        if (guestItems.length > 0) {
          setCartItems(guestItems);
          setIsGuestFlow(true);
        } else {
          const guestBuyNowItem = getGuestBuyNowItem();

          if (guestBuyNowItem) {
            setCartItems([guestBuyNowItem]);
            setIsGuestFlow(true);
          } else {
            router.push("/cart");
            return;
          }
        }
      } else {
        if (!user) {
          const guestItems = getGuestCartItems();
          const guestBuyNowItem = getGuestBuyNowItem();
          if (guestItems.length > 0) {
            setCartItems(guestItems);
            setIsGuestFlow(true);
          } else if (guestBuyNowItem) {
            setCartItems([guestBuyNowItem]);
            setIsGuestFlow(true);
          } else {
            router.push("/cart");
            return;
          }

          setLoading(false);
          return;
        }

        const cart = await getCart(user.id);
        setCartItems(cart);
        setIsGuestFlow(false);

        if (cart.length === 0) {
          router.push("/cart");
          return;
        }
      }

      setLoading(false);
    };

    loadData();
  }, []);

  const total = cartItems.reduce((sum, item) => {
    const product = item.product || {};
    return (
      sum + getEffectiveProductPrice(item.product) * (item.quantity_ordered || 1)
    );
  }, 0);

  const formatPhoneNumber = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    if (!digitsOnly) {
      return "";
    }

    let localDigits = digitsOnly;

    if (localDigits.startsWith("233")) {
      localDigits = localDigits.slice(3);
    }

    if (localDigits.startsWith("0")) {
      localDigits = localDigits.slice(1);
    }

    localDigits = localDigits.slice(0, 9);

    if (!localDigits) {
      return "";
    }

    return `+233${localDigits}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const handleSubmitShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deliveryType === "delivery" && (!address || !town || !region)) {
      alert("Please fill in all delivery address fields");
      return;
    }
    if (!phone) {
      alert("Please enter a phone number");
      return;
    }

    if (!user && (!firstName || !lastName || !email)) {
      alert("Please fill in your name and email to continue as a guest.");
      return;
    }

    if (!user) {
      saveGuestCheckoutDraft({
        firstName,
        lastName,
        email,
        phone,
        address,
        town,
        region,
      });
    }

    setShowPayment(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    setProcessing(true);

    try {
      const checkoutReference = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const guestToken = user
        ? null
        : window.crypto?.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const serializedCartItems = cartItems.map((item) => ({
        product_id: item.product_id,
        color_id: item.color_id,
        quantity_id: item.quantity_id,
        quantity_ordered: item.quantity_ordered || 1,
        price_at_purchase: getEffectiveProductPrice(item.product),
      }));

      const guestInfo = user
        ? null
        : {
            firstName,
            lastName,
            email,
            phone,
            address,
            town,
            region,
          };

      try {
        window.sessionStorage.setItem(
          "aura-luxe-pending-payment-reference",
          checkoutReference,
        );
        if (guestToken) {
          window.sessionStorage.setItem(
            "aura-luxe-pending-payment-token",
            guestToken,
          );
        }
      } catch (e) {
        // ignore storage errors
      }

      // Preserve the guest token/email locally so the confirmation page can recover after redirect.
      if (!user && guestToken) {
        persistGuestOrderContext({
          token: guestToken,
          email,
        });
      }

      // Initialize Paystack transaction with the entire checkout payload.
      const callbackUrl = `${window.location.origin}/order-confirmation/${checkoutReference}${guestToken ? `?token=${encodeURIComponent(guestToken)}` : ""}`;

      // Keep a local pointer to the pending checkout in case the redirect is interrupted.
      try {
        window.sessionStorage.setItem("aura-luxe-pending-checkout-email", email);
      } catch (e) {
        // ignore storage errors
      }

      const paystackRes = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user?.email || email,
          amountGhs: total,
          reference: checkoutReference,
          callback_url: callbackUrl,
          metadata: {
            checkout_reference: checkoutReference,
            guest_token: guestToken,
            user_id: user?.id || null,
            delivery_type: deliveryType,
            guest_info: guestInfo,
            cart_items: serializedCartItems,
            total_amount: total,
            order_mode: checkoutMode,
          },
        }),
      });

      if (!paystackRes.ok) {
        const errData = await paystackRes.json();
        throw new Error(errData.error || "Failed to initialize payment");
      }

      const paystackData = await paystackRes.json();
      const authorizationUrl = paystackData.data?.data?.authorization_url;

      if (!authorizationUrl) {
        throw new Error("No authorization URL from Paystack");
      }

      // Redirect user to Paystack checkout
      window.location.href = authorizationUrl;
    } catch (error) {
      console.error("Payment error:", error);
      const message = error instanceof Error ? error.message : "";
      alert(message || "Payment failed. Please try again.");
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
        </div>
      </main>
    );
  }

  if (cartItems.length === 0) {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <p className="text-gray-500">Cart is empty</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          href="/cart"
          className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cart
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Forms */}
          <div className="lg:col-span-2 space-y-8">
            {/* Shipping Form */}
            {!showPayment && (
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Order Information
                </h2>

                {!user && (
                  <div className="mb-8 rounded-2xl border border-border/30 bg-card p-4 sm:p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                      Checkout As
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setCheckoutChoice("guest")}
                        className={`text-left rounded-2xl border-2 p-5 transition-all ${
                          checkoutChoice === "guest"
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border/30 bg-background hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2">
                                <circle cx="12" cy="8" r="4" />
                                <path d="M4 20c1.8-4 5-6 8-6s6.2 2 8 6" />
                              </svg>
                            </div>
                            <h4 className="text-lg font-semibold text-foreground">
                              Guest Checkout
                            </h4>
                            <p className="mt-1 text-sm text-foreground/70">
                              Quick checkout without creating an account
                            </p>
                          </div>
                          <div className={`mt-1 h-6 w-6 rounded-full border-2 ${checkoutChoice === "guest" ? "border-primary bg-primary" : "border-border/30"}`} />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          saveGuestCheckoutDraft({
                            firstName,
                            lastName,
                            email,
                            phone,
                            address,
                            town,
                            region,
                          });
                          router.push(
                            "/auth/login?returnTo=%2Fcheckout%3Fmode%3Dguest",
                          );
                        }}
                        className="text-left rounded-2xl border-2 border-border/30 bg-background p-5 transition-all hover:border-primary/40"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2">
                                <circle cx="12" cy="7" r="4" />
                                <path d="M5 21c1.4-3.5 4.2-5.5 7-5.5S17.6 17.5 19 21" />
                              </svg>
                            </div>
                            <h4 className="text-lg font-semibold text-foreground">
                              Create Account
                            </h4>
                            <p className="mt-1 text-sm text-foreground/70">
                              Save your info and track orders
                            </p>
                          </div>
                          <div className="mt-1 h-6 w-6 rounded-full border-2 border-border/30" />
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Top saved-address summary removed to avoid duplication. */}

                <form onSubmit={handleSubmitShipping} className="space-y-4">
                  {/* Delivery Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Delivery Method *
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="deliveryType"
                          value="delivery"
                          checked={deliveryType === "delivery"}
                          onChange={(e) =>
                            setDeliveryType(
                              e.target.value as "delivery" | "pickup",
                            )
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">
                          Home Delivery
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="deliveryType"
                          value="pickup"
                          checked={deliveryType === "pickup"}
                          onChange={(e) =>
                            setDeliveryType(
                              e.target.value as "delivery" | "pickup",
                            )
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">Pickup</span>
                      </label>
                    </div>
                  </div>

                  {/* Guest contact info */}
                  {!user && checkoutChoice === "guest" && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            First Name *
                          </label>
                          <Input
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="First name"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Last Name *
                          </label>
                          <Input
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Last name"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email Address *
                        </label>
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                        />
                      </div>
                    </>
                  )}

                  {(deliveryType === "pickup" || deliveryType === "delivery") && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number *
                      </label>
                      <Input
                        type="tel"
                        value={phone}
                        onChange={handlePhoneChange}
                        placeholder="+233240000000"
                        maxLength={13}
                        required
                      />
                    </div>
                  )}

                  {/* Delivery Address Fields */}
                  {deliveryType === "delivery" && user && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Street Address *
                        </label>
                        <Input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Street address"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Region *
                          </label>
                          <select
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                            required
                          >
                            <option value="">Select region</option>
                            {GHANA_REGIONS.map((ghanaRegion) => (
                              <option key={ghanaRegion} value={ghanaRegion}>
                                {ghanaRegion}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            City *
                          </label>
                          <Input
                            value={town}
                            onChange={(e) => setTown(e.target.value)}
                            placeholder="City"
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {deliveryType === "delivery" && !user && checkoutChoice === "guest" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Street Address *
                        </label>
                        <Input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Street address"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Region *
                          </label>
                          <select
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                            required
                          >
                            <option value="">Select region</option>
                            {GHANA_REGIONS.map((ghanaRegion) => (
                              <option key={ghanaRegion} value={ghanaRegion}>
                                {ghanaRegion}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            City *
                          </label>
                          <Input
                            value={town}
                            onChange={(e) => setTown(e.target.value)}
                            placeholder="City"
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Pickup Info */}
                  {deliveryType === "pickup" && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <strong>Pickup Location:</strong> Accra, Ghana
                      </p>
                      <p className="text-sm text-blue-700 mt-2">
                        You will be contacted on the provided phone number to
                        confirm pickup details.
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3"
                  >
                    Continue to Payment
                  </Button>
                </form>
              </div>
            )}

            {/* Payment Form */}
            {showPayment && (
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <div className="mb-6">
                  <button
                    onClick={() => setShowPayment(false)}
                    className="text-amber-600 hover:text-amber-700 text-sm"
                  >
                    ← Back to Delivery
                  </button>
                </div>

                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Payment Information
                </h2>

                <div className="mb-8 p-4 bg-white rounded border border-gray-200">
                  <div className="text-center mb-4">
                    <div className="inline-block bg-blue-600 text-white px-4 py-2 rounded font-bold">
                      PAYSTACK
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-600">
                    Secure Payment Gateway - Mobile Money & Card Payments
                  </p>
                </div>

                <form onSubmit={handlePayment} className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded p-4">
                    <p className="text-sm text-blue-800">
                      ✓ Click "Proceed to Payment" to securely pay via Paystack using Mobile Money (MTN, Vodafone, Airtel) or Card.
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded p-4 border border-gray-200">
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Amount to Pay:</strong>
                    </p>
                    <p className="text-2xl font-bold text-amber-600">
                      GHS {total.toFixed(2)}
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={processing}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg"
                  >
                    {processing ? "Redirecting to Payment..." : "Proceed to Payment"}
                  </Button>
                </form>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Order Summary
              </h2>

              <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                {cartItems.map((item) => (
                  <div key={item.id} className="text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-700">
                        {item.product?.name} x{item.quantity_ordered}
                      </span>
                      <div className="text-right">
                        {item.product?.promo_enabled && item.product?.discounted_price ? (
                          <>
                            <span className="text-xs text-gray-500 line-through block">
                              {formatPrice(
                                (item.product.original_price || item.product.price || 0) *
                                  item.quantity_ordered,
                              )}
                            </span>
                            <span className="text-gray-900 font-medium block">
                              {formatPrice(
                                getEffectiveProductPrice(item.product) *
                                  item.quantity_ordered,
                              )}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-900 font-medium">
                            {formatPrice(
                              getEffectiveProductPrice(item.product) *
                                item.quantity_ordered,
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.color?.color_name} • {item.quantity?.length_inches}
                      {'"'}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 mb-6 pb-6 border-b border-gray-200">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery</span>
                  <span>To be determined</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-amber-600">
                  {formatPrice(total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <WhatsAppButton message="Hi AuraLuxe Extensions, I need help with checkout." />
    </main>
  );
}
