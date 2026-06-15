"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/currency";
import { X, ShoppingCart, Bolt } from "lucide-react";
import {
  Product,
  ProductColor,
  addToCart,
  getEffectiveProductPrice,
} from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import {
  addGuestCartItem,
  saveGuestBuyNowItem,
} from "@/lib/guest-cart";
import { toast } from "sonner";

interface ProductModalProps {
  product: Product;
  colors: ProductColor[];
  onClose: () => void;
  onAddedToCart?: () => void;
}

export default function ProductModal({
  product,
  colors,
  onClose,
  onAddedToCart,
}: ProductModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedColor, setSelectedColor] = useState<string>(
    colors[0]?.id || "",
  );
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [displayImageUrl, setDisplayImageUrl] = useState(
    colors[0]?.image_url || product.image_url || "",
  );
  const supabase = createClient();

  const selectedColorData = colors.find((c) => c.id === selectedColor);
  const availableStock = selectedColorData?.stock_quantity || 0;
  const isSoldOut = availableStock <= 0;
  const unitPrice = getEffectiveProductPrice(product);

  useEffect(() => {
    const preloadUrls = [
      product.image_url,
      ...colors.map((color) => color.image_url),
    ].filter((url): url is string => Boolean(url));

    preloadUrls.forEach((url) => {
      const image = new window.Image();
      image.src = url;
    });
  }, [colors, product.image_url]);

  useEffect(() => {
    const nextUrl = selectedColorData?.image_url || product.image_url || "";

    setDisplayImageUrl(nextUrl);
  }, [product.image_url, selectedColorData?.image_url]);

  const handleAddToCart = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (quantity > availableStock) {
      toast.error(
        `Sorry, only ${availableStock} ${availableStock === 1 ? "piece" : "pieces"} available for this selection.`,
      );
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      const returnTo = encodeURIComponent(pathname);
      toast.error("Sign in required", {
        duration: 5000,
        description: (
          <div className="mt-2 text-sm text-foreground leading-relaxed">
            Already have an account?{" "}
            <Link href={`/auth/login?returnTo=${returnTo}`} className="font-bold underline text-amber-600 hover:text-amber-800 transition-colors">
              Sign in
            </Link>
            {" "}else{" "}
            <Link href={`/auth/sign-up?returnTo=${returnTo}`} className="font-bold underline text-amber-600 hover:text-amber-800 transition-colors">
              sign up here
            </Link>
            {" "}to access your cart and complete your order.
          </div>
        ),
      });
      return;
    }

    setLoading(true);
    try {
      await addToCart(session.user.id, product.id, selectedColor, null, quantity);
      toast.success("Added to cart successfully! 🛍️");
      window.dispatchEvent(new Event('aura-luxe-cart-updated'));
      // Don't close the modal - keep it open so user can order different colors
      setQuantity(1); // Reset quantity for next order
    } catch (error) {
      console.error("Error adding to cart:", error);
      toast.error("Failed to add to cart. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNow = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (quantity > availableStock) {
      toast.error(
        `Sorry, only ${availableStock} ${availableStock === 1 ? "piece" : "pieces"} available for this selection.`,
      );
      return;
    }

    setLoading(true);
    try {
      const buyNowItem = {
        id: `buy-now-${product.id}-${selectedColor}-null`,
        user_id: user?.id || "",
        product_id: product.id,
        color_id: selectedColor,
        quantity_id: null,
        quantity_ordered: quantity,
        product: {
          ...product,
          price: getEffectiveProductPrice(product),
        },
        color: selectedColorData,
        quantity: undefined,
      };

      if (user) {
        window.sessionStorage.setItem("aura-luxe-buy-now", JSON.stringify(buyNowItem));
      } else {
        saveGuestBuyNowItem(buyNowItem);
      }
      window.sessionStorage.setItem("aura-luxe-checkout-mode", "buy-now");
      onClose();
      router.push("/checkout?mode=buy-now");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to proceed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">{product.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Image and Info */}
            <div className="flex flex-col">
              <div className="h-64 md:h-96 bg-gray-200 rounded-lg overflow-hidden mb-4">
                {displayImageUrl ? (
                  <Image
                    src={displayImageUrl}
                    alt={
                      selectedColorData?.color_name
                        ? `${product.name} - ${selectedColorData.color_name}`
                        : product.name
                    }
                    width={400}
                    height={400}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-300">
                    <span className="text-gray-500">No image</span>
                  </div>
                )}
              </div>

              {/* Product Info under image */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-semibold text-gray-900 mb-2">
                    Product Info
                  </p>
                  {product.length_inches || product.weight_grams ? (
                    <p className="text-sm text-gray-600 mb-1">
                      {product.length_inches ? `Length: ${product.length_inches}" ` : ''}{product.length_inches && product.weight_grams ? '• ' : ''}{product.weight_grams ? `Weight: ${product.weight_grams}g` : ''}
                    </p>
                  ) : null}
                  <p className="text-sm text-gray-600 mb-2">
                    In Stock: {availableStock} pieces
                  </p>
                  {availableStock < 10 && availableStock > 0 && (
                      <p className="text-sm text-orange-600 font-semibold">
                        ⚠️ Only {availableStock} left!
                      </p>
                    )}
                  {availableStock <= 0 && (
                    <p className="text-sm text-red-600 font-semibold">
                      Out of stock
                    </p>
                  )}
                </div>
            </div>

            {/* Details */}
            <div className="flex flex-col">
              <div className="mb-6">
                <p className="text-gray-600 mb-4">{product.description}</p>

                {/* Simplified Price Display */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <div className="text-sm text-gray-600 mb-2">
                    Price: {formatPrice(unitPrice)} × {quantity}{" "}
                    {quantity === 1 ? "piece" : "pieces"}
                  </div>
                  <div className="text-3xl font-bold text-amber-700">
                    {formatPrice(unitPrice * quantity)}
                  </div>
                </div>
              </div>

              {/* Color Selection */}
              {product.product_type === 'extension' && colors.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Color
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {colors.map((color) => {
                      const colorSoldOut = (color.stock_quantity || 0) <= 0;
                      return (
                      <button
                        key={color.id}
                        onClick={() => setSelectedColor(color.id)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          selectedColor === color.id
                            ? "border-amber-600 bg-amber-50"
                            : "border-gray-200 hover:border-gray-300"
                        } ${colorSoldOut ? 'opacity-50' : ''}`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-2">
                            {color.image_url ? (
                              <div className="relative w-6 h-6 rounded-full border overflow-hidden shrink-0">
                                <Image src={color.image_url} alt={color.color_name} fill sizes="24px" className="object-cover" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full border shrink-0" style={{ backgroundColor: color.color_hex || "#ccc" }} />
                            )}
                            <span className="text-sm text-gray-700">
                              {color.color_name}
                            </span>
                          </div>
                          {colorSoldOut ? (
                            <span className="text-xs text-red-500 font-semibold mt-1">Sold out</span>
                          ) : (
                            <span className="text-xs text-gray-500 mt-1">{color.stock_quantity} left</span>
                          )}
                        </div>
                      </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Quantity
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 border border-gray-200 rounded-lg hover:bg-gray-100"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    min="1"
                    max={availableStock}
                    className="w-16 text-center border border-gray-200 rounded-lg py-2"
                  />
                  <button
                    onClick={() =>
                      setQuantity(
                        Math.min(
                          quantity + 1,
                          availableStock || 999,
                        ),
                      )
                    }
                    className="w-10 h-10 border border-gray-200 rounded-lg hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleBuyNow}
                  disabled={loading || isSoldOut}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Bolt className="w-5 h-5" />
                  {loading ? "Processing..." : "Buy Now"}
                </Button>
                <Button
                  onClick={handleAddToCart}
                  disabled={loading || isSoldOut}
                  variant="outline"
                  className="w-full py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {loading ? "Adding..." : "Add to Cart"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
