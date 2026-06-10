"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/currency";
import { Product, ProductImage, getProductDetails } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { Check, Edit2, Plus, Trash2, X } from "lucide-react";

interface ProductColorForm {
  id?: string;
  color_name: string;
  color_hex: string;
  image_url: string;
  image_file: File | null;
  image_preview_url: string;
  stock_quantity: string;
}

interface ProductFormState {
  product_type: "extension" | "product";
  name: string;
  description: string;
  price: string;
  promo_enabled: boolean;
  original_price: string;
  discounted_price: string;
  image_url: string;
  base_image_file: File | null;
  base_image_preview_url: string;
  is_trending: boolean;
  weight_grams: string;
  length_inches: string;
  simple_stock: string;
  colors: ProductColorForm[];
}

const DEFAULT_COLOR_HEX = "#8b5a3c";

function createEmptyColor(): ProductColorForm {
  return {
    color_name: "",
    color_hex: DEFAULT_COLOR_HEX,
    image_url: "",
    image_file: null,
    image_preview_url: "",
    stock_quantity: "0",
  };
}

function createEmptyForm(): ProductFormState {
  return {
    product_type: "extension",
    name: "",
    description: "",
    price: "",
    promo_enabled: false,
    original_price: "",
    discounted_price: "",
    image_url: "",
    base_image_file: null,
    base_image_preview_url: "",
    is_trending: false,
    weight_grams: "",
    length_inches: "",
    simple_stock: "0",
    colors: [createEmptyColor()],
  };
}

function getAdminProductErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("row-level security")) {
      return "Supabase is still blocking admin product saves. Run supabase-product-admin-setup.sql in the Supabase SQL editor, then try again.";
    }

    if (message.includes("bucket") || message.includes("storage")) {
      return "The product image bucket is not fully set up yet. Run supabase-product-admin-setup.sql in the Supabase SQL editor, then try again.";
    }

    return error.message;
  }

  return "Unable to save product. Run supabase-product-admin-setup.sql in the Supabase SQL editor, then try again.";
}

interface AdminProductsProps {
  searchQuery?: string;
}

export default function AdminProducts({
  searchQuery = "",
}: AdminProductsProps) {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProductFormState>(createEmptyForm());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setProducts(data as Product[]);
    }

    setRefreshKey((prev) => prev + 1);
    setLoading(false);
  };

  const resetForm = () => {
    setFormData(createEmptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const updateFormField = (
    field: keyof Omit<ProductFormState, "colors">,
    value: string | boolean | File | null,
  ) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateColor = (
    index: number,
    field: keyof ProductColorForm,
    value: string | File | null,
  ) => {
    setFormData((current) => ({
      ...current,
      colors: current.colors.map((color, colorIndex) =>
        colorIndex === index
          ? {
              ...color,
              [field]: value,
            }
          : color,
      ),
    }));
  };

  const addColor = () => {
    setFormData((current) => ({
      ...current,
      colors: [...current.colors, createEmptyColor()],
    }));
  };

  const removeColor = (index: number) => {
    setFormData((current) => ({
      ...current,
      colors:
        current.colors.length === 1
          ? current.colors
          : current.colors.filter((_, colorIndex) => colorIndex !== index),
    }));
  };

  const startCreateProduct = () => {
    setEditingId(null);
    setFormData(createEmptyForm());
    setShowForm(true);
  };

  const startEditProduct = async (product: Product) => {
    setSubmitting(true);

    try {
      const details = await getProductDetails(product.id);

      if (!details) {
        alert("Unable to load product details");
        return;
      }

      setFormData({
        product_type: details.product.product_type || "extension",
        name: details.product.name,
        description: details.product.description || "",
        price: details.product.price.toString(),
        promo_enabled: details.product.promo_enabled ?? false,
        original_price:
          details.product.original_price != null
            ? details.product.original_price.toString()
            : "",
        discounted_price:
          details.product.discounted_price != null
            ? details.product.discounted_price.toString()
            : "",
        image_url: details.product.image_url || "",
        base_image_file: null,
        base_image_preview_url: details.product.image_url || "",
        is_trending: details.product.is_trending,
        weight_grams: details.product.weight_grams?.toString() || "",
        length_inches: details.product.length_inches?.toString() || "",
        simple_stock: details.colors.length > 0 ? (details.colors[0].stock_quantity || 0).toString() : "0",
        colors:
          details.colors.length > 0
            ? details.colors.map((color) => ({
                id: color.id,
                color_name: color.color_name,
                color_hex: color.color_hex || DEFAULT_COLOR_HEX,
                image_url: color.image_url || "",
                image_file: null,
                image_preview_url: color.image_url || "",
                stock_quantity: (color.stock_quantity || 0).toString(),
              }))
            : [createEmptyColor()],
      });
      setEditingId(product.id);
      setShowForm(true);
    } finally {
      setSubmitting(false);
    }
  };

  const validateForm = () => {
    if (!formData.name.trim() || !formData.price.trim()) {
      alert("Please fill in the product name and price.");
      return false;
    }

    if (Number.isNaN(Number(formData.price))) {
      alert("Please enter a valid price.");
      return false;
    }

    if (formData.promo_enabled) {
      const originalPrice = Number(formData.original_price);
      const discountedPrice = Number(formData.discounted_price);

      if (
        !formData.original_price.trim() ||
        !formData.discounted_price.trim() ||
        Number.isNaN(originalPrice) ||
        Number.isNaN(discountedPrice)
      ) {
        alert("Please enter valid original and discounted promo prices.");
        return false;
      }

      if (discountedPrice >= originalPrice) {
        alert("Discounted price should be lower than the original price.");
        return false;
      }
    }

    const hasAnyImage =
      Boolean(formData.base_image_file) ||
      Boolean(formData.image_url) ||
      formData.colors.some(
        (color) => Boolean(color.image_file) || Boolean(color.image_url),
      );

    if (!hasAnyImage) {
      alert("Please upload a main product image or at least one color image.");
      return false;
    }

    if (formData.product_type === "extension") {
      if (formData.weight_grams && Number.isNaN(Number(formData.weight_grams))) {
        alert("Please enter a valid weight in grams.");
        return false;
      }
      if (!formData.length_inches.trim() || Number.isNaN(Number(formData.length_inches))) {
        alert("Please enter a valid length in inches.");
        return false;
      }
      const validColors = formData.colors.filter((color) => color.color_name.trim());
      if (validColors.length === 0) {
        alert("Please add at least one color/variant to track stock.");
        return false;
      }
    } else {
      if (!formData.simple_stock.trim() || Number.isNaN(Number(formData.simple_stock))) {
        alert("Please enter a valid stock quantity for this product.");
        return false;
      }
    }

    return true;
  };

  const uploadImage = async (
    productId: string,
    folder: "products" | "colors" | "gallery",
    file: File,
  ) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
    const filePath = `${folder}/${productId}/${Date.now()}-${crypto.randomUUID()}-${safeName || `image.${extension}`}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(filePath, file, {
        upsert: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  const syncColors = async (productId: string) => {
    const validColors =
      formData.product_type === "product"
        ? [
            {
              ...(formData.colors[0] || createEmptyColor()),
              color_name: "Default",
              color_hex: DEFAULT_COLOR_HEX,
              stock_quantity: formData.simple_stock,
            } as ProductColorForm,
          ]
        : formData.colors.filter((color) => color.color_name.trim());
    const { data: existingColors } = await supabase
      .from("product_colors")
      .select("id")
      .eq("product_id", productId);

    const savedColorIds: string[] = [];
    const savedColorImageUrls: string[] = [];

    for (const color of validColors) {
      const imageUrl = color.image_file
        ? await uploadImage(productId, "colors", color.image_file)
        : color.image_url || null;

      const payload = {
        product_id: productId,
        color_name: color.color_name.trim(),
        color_hex: color.color_hex || DEFAULT_COLOR_HEX,
        image_url: imageUrl,
        stock_quantity: Number(color.stock_quantity) || 0,
      };

      if (color.id) {
        const { error } = await supabase
          .from("product_colors")
          .update(payload)
          .eq("id", color.id);

        if (error) {
          throw new Error(error.message);
        }

        savedColorIds.push(color.id);
      } else {
        const { data, error } = await supabase
          .from("product_colors")
          .insert(payload)
          .select("id")
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (data?.id) {
          savedColorIds.push(data.id);
        }
      }

      if (imageUrl) {
        savedColorImageUrls.push(imageUrl);
      }
    }

    const idsToDelete = (existingColors ?? [])
      .map((color) => color.id)
      .filter((id) => !savedColorIds.includes(id));

    if (idsToDelete.length > 0) {
      const { error } = await supabase
        .from("product_colors")
        .delete()
        .in("id", idsToDelete);

      if (error) {
        throw new Error(error.message);
      }
    }

    return savedColorImageUrls;
  };

  const persistProduct = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      let productId = editingId;

      if (!productId) {
        const { data, error } = await supabase
          .from("products")
          .insert({
            product_type: formData.product_type,
            name: formData.name.trim(),
            description: formData.description.trim(),
            price: Number(formData.price),
            promo_enabled: formData.promo_enabled,
            original_price: formData.promo_enabled
              ? Number(formData.original_price)
              : null,
            discounted_price: formData.promo_enabled
              ? Number(formData.discounted_price)
              : null,
            weight_grams: Number(formData.weight_grams) || 0,
            length_inches: Number(formData.length_inches) || 0,
            image_url: null,
            is_trending: formData.is_trending,
          })
          .select("id")
          .single();

        if (error || !data?.id) {
          throw new Error(error?.message || "Unable to create product.");
        }

        productId = data.id;
      }

      let mainImageUrl = formData.image_url || "";

      if (formData.base_image_file) {
        mainImageUrl = await uploadImage(
          productId,
          "products",
          formData.base_image_file,
        );
      }

      const colorImageUrls = await syncColors(productId);
      if (!mainImageUrl && colorImageUrls.length > 0) {
        mainImageUrl = colorImageUrls[0];
      }
      const { error: updateError } = await supabase
        .from("products")
        .update({
          product_type: formData.product_type,
          name: formData.name.trim(),
          description: formData.description.trim(),
          price: Number(formData.price),
          promo_enabled: formData.promo_enabled,
          original_price: formData.promo_enabled
            ? Number(formData.original_price)
            : null,
          discounted_price: formData.promo_enabled
            ? Number(formData.discounted_price)
            : null,
          weight_grams: Number(formData.weight_grams) || 0,
          length_inches: Number(formData.length_inches) || 0,
          image_url: mainImageUrl || null,
          is_trending: formData.is_trending,
        })
        .eq("id", productId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      resetForm();
      await loadProducts();
    } catch (error) {
      console.error(error);
      alert(getAdminProductErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) {
      return;
    }

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) {
      alert(getAdminProductErrorMessage(error));
      return;
    }

    await loadProducts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const filteredProducts = products.filter((product) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return `${product.name} ${product.description || ""}`
      .toLowerCase()
      .includes(query);
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Products</h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload product photos from your computer, attach color images, and
            manage stock. Run supabase-product-admin-setup.sql in Supabase once
            before your first save.
          </p>
        </div>
        <Button
          onClick={startCreateProduct}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8 space-y-8">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h3 className="font-semibold text-gray-900">
                {editingId ? "Edit Product" : "Add New Product"}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Use one main image plus optional color-specific images for the
                same product.
              </p>
            </div>
            <button
              onClick={resetForm}
              className="p-2 text-gray-500 hover:text-gray-700"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Type
              </label>
              <select
                value={formData.product_type}
                onChange={(event) =>
                  updateFormField(
                    "product_type",
                    event.target.value as "extension" | "product",
                  )
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              >
                <option value="extension">Extension</option>
                <option value="product">Hair Product</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name
              </label>
              <Input
                value={formData.name}
                onChange={(event) =>
                  updateFormField("name", event.target.value)
                }
                placeholder="Raw body wave"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price in Ghana Cedis
              </label>
              <Input
                type="number"
                value={formData.price}
                onChange={(event) =>
                  updateFormField("price", event.target.value)
                }
                placeholder="850"
                step="0.01"
              />
            </div>
            
            {formData.product_type === "extension" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weight (grams)
                  </label>
                  <Input
                    type="number"
                    value={formData.weight_grams}
                    onChange={(event) =>
                      updateFormField("weight_grams", event.target.value)
                    }
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Length (inches)
                  </label>
                  <Input
                    type="number"
                    value={formData.length_inches}
                    onChange={(event) =>
                      updateFormField("length_inches", event.target.value)
                    }
                    placeholder="18"
                  />
                </div>
              </>
            )}
            {formData.product_type === "product" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stock Quantity
                </label>
                <Input
                  type="number"
                  value={formData.simple_stock}
                  onChange={(event) =>
                    updateFormField("simple_stock", event.target.value)
                  }
                  placeholder="20"
                />
              </div>
            )}
          </div>

          <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/60">
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={formData.promo_enabled}
                onChange={() =>
                  setFormData((current) => ({
                    ...current,
                    promo_enabled: !current.promo_enabled,
                    original_price: current.promo_enabled
                      ? ""
                      : current.original_price || current.price,
                    discounted_price: current.promo_enabled
                      ? ""
                      : current.discounted_price,
                  }))
                }
              />
              <span className="text-sm font-medium text-gray-700">
                Enable promo pricing
              </span>
            </label>

            {formData.promo_enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Original Price
                  </label>
                  <Input
                    type="number"
                    value={formData.original_price}
                    onChange={(event) =>
                      updateFormField("original_price", event.target.value)
                    }
                    placeholder="1000"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discounted Price
                  </label>
                  <Input
                    type="number"
                    value={formData.discounted_price}
                    onChange={(event) =>
                      updateFormField("discounted_price", event.target.value)
                    }
                    placeholder="850"
                    step="0.01"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(event) =>
                updateFormField("description", event.target.value)
              }
              placeholder="Describe texture, origin, and finish"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Main Product Image
            </label>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                updateFormField("base_image_file", file);
                updateFormField(
                  "base_image_preview_url",
                  file ? URL.createObjectURL(file) : formData.image_url,
                );
              }}
            />
            <p className="text-xs text-gray-500 mt-2">
              This is the default image used on the storefront. If you skip it,
              the first color image will be used.
            </p>
            {formData.base_image_preview_url && (
              <img
                src={formData.base_image_preview_url}
                alt="Product preview"
                className="mt-4 h-40 w-32 object-cover rounded-lg border border-gray-200"
              />
            )}
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_trending}
                onChange={() =>
                  updateFormField("is_trending", !formData.is_trending)
                }
              />
              <span className="text-sm text-gray-700">Mark as Trending</span>
            </label>
          </div>

          {formData.product_type === "extension" && (
            <div className="border-t border-gray-200 pt-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h4 className="font-semibold text-gray-900">Colors / Variants</h4>
                <p className="text-sm text-gray-600">
                  Add each available color or variant and set its stock quantity. Hair products can just have a "Default" variant.
                </p>
              </div>
              <Button onClick={addColor} type="button" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Color
              </Button>
            </div>

            <div className="space-y-4">
              {formData.colors.map((color, index) => (
                <div
                  key={color.id || `color-${index}`}
                  className="grid grid-cols-1 lg:grid-cols-[1.4fr_100px_1.4fr_100px] gap-4 items-start border border-gray-200 rounded-lg p-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Color Name
                    </label>
                    <Input
                      value={color.color_name}
                      onChange={(event) =>
                        updateColor(index, "color_name", event.target.value)
                      }
                      placeholder="Natural black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stock
                    </label>
                    <Input
                      type="number"
                      value={color.stock_quantity}
                      onChange={(event) =>
                        updateColor(index, "stock_quantity", event.target.value)
                      }
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Color Image
                    </label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        updateColor(index, "image_file", file);
                        updateColor(
                          index,
                          "image_preview_url",
                          file ? URL.createObjectURL(file) : color.image_url,
                        );
                      }}
                    />
                    {color.image_preview_url && (
                      <img
                        src={color.image_preview_url}
                        alt={color.color_name || `Color ${index + 1}`}
                        className="mt-3 h-24 w-24 object-cover rounded-lg border border-gray-200"
                      />
                    )}
                  </div>
                  <div className="flex justify-end lg:justify-center pt-7">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeColor(index)}
                      disabled={formData.colors.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={persistProduct}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {submitting
                ? "Saving..."
                : editingId
                  ? "Save Changes"
                  : "Create Product"}
            </Button>
            <Button onClick={resetForm} variant="outline" disabled={submitting}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Product
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Price
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Inventory
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Status
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr
                key={product.id}
                className="border-b border-gray-200 hover:bg-gray-50"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-gray-400">No image</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        {product.product_type === "product" ? "Hair Product" : "Extension"}
                      </p>
                      <p className="text-sm text-gray-600 line-clamp-1">
                        {product.description}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    {product.promo_enabled && product.discounted_price ? (
                      <>
                        <span className="text-xs text-gray-500 line-through">
                          {formatPrice(product.original_price || product.price)}
                        </span>
                        <span className="font-semibold text-amber-600">
                          {formatPrice(product.discounted_price)}
                        </span>
                      </>
                    ) : (
                      <span className="font-semibold text-amber-600">
                        {formatPrice(product.price)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <ProductStockDisplay productId={product.id} refreshKey={refreshKey} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded ${product.product_type === "product" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}`}
                    >
                      {product.product_type === "product" ? "Product" : "Extension"}
                    </span>
                    {product.is_trending && (
                      <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded">
                        Trending
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditProduct(product)}
                      className="p-2 text-blue-600 hover:text-blue-700"
                      title="Edit product"
                      disabled={submitting}
                    >
                      {editingId === product.id && showForm ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Edit2 className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="p-2 text-red-600 hover:text-red-700"
                      title="Delete product"
                      disabled={submitting}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredProducts.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">No products match your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Component to display stock for each color
function ProductStockDisplay({ productId, refreshKey }: { productId: string, refreshKey: number }) {
  const supabase = createClient();
  const [colors, setColors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadColorStock();
  }, [productId, refreshKey]);

  const loadColorStock = async () => {
    const { data, error } = await supabase
      .from("product_colors")
      .select(
        `
        id,
        color_name,
        stock_quantity,
        image_url
      `,
      )
      .eq("product_id", productId);

    if (!error && data) {
      setColors(data);
    }
    setLoading(false);
  };

  if (loading) {
    return <span className="text-sm text-gray-600">Loading...</span>;
  }

  if (colors.length === 0) {
    return <span className="text-sm text-gray-600">No colors</span>;
  }

  return (
    <div className="space-y-1 text-sm">
      {colors.map((color) => {
        const totalStock = color.stock_quantity || 0;
        const lowStock = totalStock < 10;

        return (
          <div key={color.id} className="flex items-center gap-2">
            {color.image_url ? (
              <img src={color.image_url} alt={color.color_name} className="w-5 h-5 rounded-full object-cover border border-gray-300 shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full border border-gray-300 bg-gray-200 shrink-0"></div>
            )}
            <span className="text-gray-700">{color.color_name}</span>
            <span
              className={`font-semibold ${lowStock && totalStock > 0 ? "text-orange-600" : totalStock === 0 ? "text-red-600" : "text-gray-600"}`}
            >
              {totalStock} left
            </span>
          </div>
        );
      })}
    </div>
  );
}