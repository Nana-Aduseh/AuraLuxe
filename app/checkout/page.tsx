"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/currency";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getCart, createOrder, CartItem } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

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
  const [showPayment, setShowPayment] = useState(false);
  const [useSavedAddress, setUseSavedAddress] = useState(false);
  const [savedAddress, setSavedAddress] = useState<any>(null);
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">(
    "delivery",
  );
  const [checkoutMode, setCheckoutMode] = useState<"cart" | "buy-now">("cart");
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
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  // Payment form states
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCVC, setCardCVC] = useState("");

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      setUser(user);
      setEmail(user.email || "");

      // Load saved address
      const { data: address } = await supabase
        .from("user_addresses")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (address) {
        setSavedAddress(address);
        // Auto-load saved address
        setFirstName(address.first_name);
        setLastName(address.last_name);
        setEmail(address.email);
        setAddress(address.address);
        setTown(address.town);
        setRegion(address.region);
        setPhone(address.phone || "");
        setUseSavedAddress(true);
        setIsEditingAddress(false);
      } else {
        setUseSavedAddress(false);
      }

      const urlMode = new URLSearchParams(window.location.search).get("mode");
      const storedMode = window.sessionStorage.getItem(
        "aura-luxe-checkout-mode",
      );
      const mode =
        urlMode === "buy-now" || storedMode === "buy-now" ? "buy-now" : "cart";

      setCheckoutMode(mode);

      if (mode === "buy-now") {
        const savedBuyNowItem =
          window.sessionStorage.getItem("aura-luxe-buy-now");

        if (!savedBuyNowItem) {
          router.push("/cart");
          return;
        }

        try {
          const parsedItem = JSON.parse(savedBuyNowItem);
          setCartItems([parsedItem]);
        } catch {
          router.push("/cart");
          return;
        }
      } else {
        const cart = await getCart(user.id);
        setCartItems(cart);

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
    return sum + (product.price || 0) * (item.quantity_ordered || 1);
  }, 0);

  const handleUseSavedAddress = () => {
    if (savedAddress) {
      setFirstName(savedAddress.first_name);
      setLastName(savedAddress.last_name);
      setEmail(savedAddress.email);
      setAddress(savedAddress.address);
      setTown(savedAddress.town);
      setRegion(savedAddress.region);
      setPhone(savedAddress.phone || "");
      setUseSavedAddress(true);
      setIsEditingAddress(false);
    }
  };

  const handleEditAddress = () => {
    setIsEditingAddress(true);
  };

  const handleSaveAsDefault = async () => {
    if (user && deliveryType === "delivery") {
      await supabase.from("user_addresses").upsert({
        user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        email: email,
        address: address,
        town: town,
        region: region,
        phone: phone,
      });
      const { data: updatedAddress } = await supabase
        .from("user_addresses")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (updatedAddress) {
        setSavedAddress(updatedAddress);
        setIsEditingAddress(false);
      }
    }
  };

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

    // Save address if it's different from saved one
    if (user && deliveryType === "delivery" && isEditingAddress) {
      await handleSaveAsDefault();
    }

    setShowPayment(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cardName || !cardNumber || !cardExpiry || !cardCVC) {
      alert("Please fill in all payment details");
      return;
    }

    setProcessing(true);

    try {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Create order
      if (user) {
        const order = await createOrder(
          user.id,
          cartItems,
          total,
          deliveryType,
          checkoutMode !== "buy-now",
        );

        if (order) {
          window.sessionStorage.removeItem("aura-luxe-buy-now");
          window.sessionStorage.removeItem("aura-luxe-checkout-mode");
          router.push(`/order-confirmation/${order.id}`);
        }
      }
    } catch (error) {
      console.error("Payment error:", error);
      alert("Payment failed. Please try again.");
    } finally {
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

                {/* Saved Address Display */}
                {savedAddress && !isEditingAddress && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Saved Delivery Address
                        </p>
                        <div className="mt-2 text-sm text-gray-700 space-y-1">
                          <p>
                            {firstName} {lastName}
                          </p>
                          <p>{address}</p>
                          <p>
                            {town}, {region}
                          </p>
                          <p className="text-gray-600">Phone: {phone}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleEditAddress}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium whitespace-nowrap ml-4"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmitShipping} className="space-y-4">
                  {/* Delivery Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Delivery Method *
                    </label>
                    <div className="flex gap-4">
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

                  {/* Saved Address Display */}
                  {savedAddress &&
                    !isEditingAddress &&
                    deliveryType === "delivery" && (
                      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              Delivery Address
                            </p>
                            <div className="mt-2 text-sm text-gray-700 space-y-1">
                              <p>
                                {firstName} {lastName}
                              </p>
                              <p>{address}</p>
                              <p>
                                {town}, {region}
                              </p>
                              <p className="text-gray-600">Phone: {phone}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleEditAddress}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium whitespace-nowrap ml-4"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    )}

                  {/* Phone Number - Always show */}
                  {(isEditingAddress ||
                    !savedAddress ||
                    deliveryType === "pickup") && (
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

                  {/* Delivery Address Fields - Show when editing or no saved address */}
                  {deliveryType === "delivery" &&
                    (isEditingAddress || !savedAddress) && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Delivery Address *
                          </label>
                          <Input
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Street address"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Town *
                            </label>
                            <Input
                              value={town}
                              onChange={(e) => setTown(e.target.value)}
                              placeholder="Town/City"
                              required
                            />
                          </div>
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

                {/* Fake Paystack Logo */}
                <div className="mb-8 p-4 bg-white rounded border border-gray-200">
                  <div className="text-center mb-4">
                    <div className="inline-block bg-blue-600 text-white px-4 py-2 rounded font-bold">
                      PAYSTACK
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-600">
                    Secure Payment Gateway
                  </p>
                </div>

                <form onSubmit={handlePayment} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cardholder Name
                    </label>
                    <Input
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="John Doe"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Card Number
                    </label>
                    <Input
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4242 4242 4242 4242"
                      maxLength={19}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expiry Date
                      </label>
                      <Input
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM/YY"
                        maxLength={5}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        CVV
                      </label>
                      <Input
                        value={cardCVC}
                        onChange={(e) => setCardCVC(e.target.value)}
                        placeholder="123"
                        maxLength={4}
                        required
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-6">
                    <p className="text-sm text-blue-700">
                      💡 This is a demo. Use any card details to proceed.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={processing}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                  >
                    {processing ? "Processing Payment..." : "Complete Payment"}
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
                      <span className="text-gray-900 font-medium">
                        {formatPrice(
                          (item.product?.price || 0) * item.quantity_ordered,
                        )}
                      </span>
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
    </main>
  );
}
