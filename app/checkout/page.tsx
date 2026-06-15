"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/currency";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { getCart, CartItem, getEffectiveProductPrice } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { persistGuestOrderContext } from "@/lib/guest-orders";
import WhatsAppButton from "@/components/whatsapp-button";
import { PrePaystackModal } from "@/components/payment/pre-paystack-modal";
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

const CHECKOUT_STATE_KEY = "aura-luxe-checkout-state-v2";

function readCheckoutState() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCheckoutState(state: Record<string, unknown>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(CHECKOUT_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export default function CheckoutPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [checkoutChoice, setCheckoutChoice] = useState<"guest" | "account">("guest");
  const [isGuestFlow, setIsGuestFlow] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paystackAuthUrl, setPaystackAuthUrl] = useState<string | null>(null);
  const [pendingCheckoutReference, setPendingCheckoutReference] = useState<string | null>(null);
  const [showPrePaystack, setShowPrePaystack] = useState(false);
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
      const mode =
        urlMode === "buy-now"
          ? "buy-now"
          : urlMode === "guest" || urlMode === "cart"
            ? urlMode
            : "cart";

      setCheckoutMode(mode);

      // If we are explicitly in cart or guest mode, clear any stale buy-now item to prevent confusion
      if (mode === "cart" || mode === "guest") {
        window.sessionStorage.removeItem("aura-luxe-buy-now");
      }

      if (user && getGuestCheckoutDraft()) {
        await syncGuestDraftToUser(user.id);
      }

      const restoredState = readCheckoutState();
      if (restoredState) {
        if (typeof restoredState.firstName === "string") setFirstName(restoredState.firstName);
        if (typeof restoredState.lastName === "string") setLastName(restoredState.lastName);
        if (typeof restoredState.email === "string" && !user) setEmail(restoredState.email);
        if (typeof restoredState.address === "string") setAddress(restoredState.address);
        if (typeof restoredState.town === "string") setTown(restoredState.town);
        if (typeof restoredState.region === "string") setRegion(restoredState.region);
        if (typeof restoredState.phone === "string") setPhone(restoredState.phone);
        if (restoredState.deliveryType === "pickup" || restoredState.deliveryType === "delivery") {
          setDeliveryType(restoredState.deliveryType);
        }
        if (restoredState.checkoutChoice === "guest" || restoredState.checkoutChoice === "account") {
          setCheckoutChoice(restoredState.checkoutChoice);
        }
        if (typeof restoredState.showPayment === "boolean" && !urlMode) {
          setShowPayment(restoredState.showPayment);
        }
      }

      if (mode === "buy-now") {
        const savedBuyNowItem =
          window.sessionStorage.getItem("aura-luxe-buy-now");

        if (!savedBuyNowItem) {
          const guestBuyNowItem = getGuestBuyNowItem();

          if (!guestBuyNowItem) {
            console.warn("[Checkout] No buy-now item found in sessionStorage or guestStorage, redirecting to cart");
            router.push("/cart");
            return;
          }

          console.log("[Checkout] Using guest buy-now item");
          setCartItems([guestBuyNowItem]);
          setIsGuestFlow(!user);
          setLoading(false);
          return;
        }

        try {
          const parsedItem = JSON.parse(savedBuyNowItem);
          
          // Validate that the parsed item has required fields
          if (!parsedItem.product_id || !parsedItem.product) {
            throw new Error("Invalid buy-now item structure: missing product_id or product");
          }

          // Ensure product object has the required fields for pricing
          if (typeof parsedItem.product !== 'object' || !parsedItem.product.id) {
            throw new Error("Invalid product in buy-now item");
          }

          setCartItems([parsedItem]);
          setIsGuestFlow(false);
        } catch (err) {
          console.error("[Checkout] Failed to parse buy-now item:", err);
          const guestBuyNowItem = getGuestBuyNowItem();
          if (guestBuyNowItem) {
            console.log("[Checkout] Falling back to guest buy-now item");
            setCartItems([guestBuyNowItem]);
            setIsGuestFlow(true);
          } else {
            console.error("[Checkout] No fallback buy-now item available, redirecting to cart");
            router.push("/cart");
            return;
          }
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

  useEffect(() => {
    if (loading) {
      return;
    }

    saveCheckoutState({
      firstName,
      lastName,
      email,
      address,
      town,
      region,
      phone,
      deliveryType,
      checkoutChoice,
      showPayment,
      checkoutMode,
      isGuestFlow,
      cartItems,
    });
  }, [
    loading,
    firstName,
    lastName,
    email,
    address,
    town,
    region,
    phone,
    deliveryType,
    checkoutChoice,
    showPayment,
    checkoutMode,
    isGuestFlow,
    cartItems,
  ]);

  const total = cartItems.reduce((sum, item) => {
    const product = item.product || {};
    const price = getEffectiveProductPrice(item.product);
    const quantity = item.quantity_ordered || 1;
    const itemTotal = price * quantity;
    
    if (price === 0) {
      console.warn(`[Checkout] Item ${item.product_id} has zero price calculation`, {
        product,
        quantity,
      });
    } else {
      console.log(`[Checkout] Item ${item.product_id}: ${price} x ${quantity} = ${itemTotal}`);
    }
    
    return sum + itemTotal;
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

    setPaystackAuthUrl(null);
    setPendingCheckoutReference(null);
    setShowPayment(true);
  };

  const handlePayment = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // If we already have a URL, just show the modal and return
    if (paystackAuthUrl) {
      setShowPrePaystack(true);
      return;
    }

    if (processing) {
      return;
    }

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

      // Capture delivery info for BOTH authenticated and guest users
      const guestInfo = {
        firstName: firstName || (user?.user_metadata?.full_name?.split(" ")?.[0] || ""),
        lastName: lastName || (user?.user_metadata?.full_name?.split(" ")?.slice(1).join(" ") || ""),
        email: email || user?.email || "",
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
          firstname: firstName || user?.user_metadata?.full_name?.split(" ")?.[0] || firstName,
          lastname: lastName || user?.user_metadata?.full_name?.split(" ")?.slice(1).join(" ") || lastName,
          phone,
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
      console.log('[Checkout] Paystack initialize response:', paystackData);
      
      const authorizationUrl = paystackData.data?.authorization_url || paystackData.authorization_url || paystackData.data?.data?.authorization_url || (paystackData.data && typeof paystackData.data === 'string' ? paystackData.data : null);
      const paystackReference = paystackData.data?.reference || paystackData.reference;

      console.log('[Checkout] Extracted URL:', authorizationUrl);
      console.log('[Checkout] Extracted reference:', paystackReference);

      if (!authorizationUrl) {
        console.error('[Checkout] Failed to get authorization URL from response:', paystackData);
        throw new Error("No authorization URL from Paystack");
      }

      // Show pre-Paystack confirmation modal
      setPaystackAuthUrl(authorizationUrl);
      setPendingCheckoutReference(checkoutReference);
      setShowPrePaystack(true);
      setProcessing(false);
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
        <button
          onClick={() => router.back()}
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 mb-8 transition-colors"
          title="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

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

                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800 font-medium">
                    Please fill in your details .
                  </p>
                </div>

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
                    className="inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
                    title="Back to delivery"
                  >
                    <ArrowLeft className="w-5 h-5" />
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

                <div className="space-y-4">
                  <div className="rounded border border-yellow-300 bg-yellow-50 p-4">
                    <p className="text-sm font-semibold text-yellow-900">
                      Caution
                    </p>
                    <p className="mt-2 text-sm text-yellow-900">
                      ✓ Click "Proceed to Payment" to securely pay via Paystack using Mobile Money (MTN, Vodafone, Airtel) or Card.
                    </p>
                    <p className="mt-2 text-sm text-yellow-900">
                      If you do not receive the verification code via SMS, wait for the timer to pass and then use the WhatsApp option below to receive it there instead.
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
                    type="button"
                    disabled={processing}
                    onClick={(e) => handlePayment(e)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg"
                  >
                    {processing ? "Preparing Payment..." : "Proceed to Payment"}
                  </Button>
                </div>

                {/* Post-init helper panel intentionally removed; WhatsApp resend is shown on the redirect/verification page */}
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
                    <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap">
                      {item.color?.color_name && item.color.color_name !== 'Default' && (
                        <span>{item.color.color_name}</span>
                      )}
                      {item.product?.product_type === 'extension' && (
                        <span>
                          {item.color?.color_name && item.color.color_name !== 'Default' ? '• ' : ''}
                          {item.product.length_inches || item.quantity?.length_inches || 'N/A'}"
                        </span>
                      )}
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

      <PrePaystackModal
        isOpen={showPrePaystack}
        onProceed={() => {
          if (paystackAuthUrl) {
            window.location.href = paystackAuthUrl;
          }
        }}
        isLoading={processing}
      />
    </main>
  );
}
