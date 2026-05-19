import type { CartItem, Product, ProductColor, ProductQuantity } from "@/lib/api";

const GUEST_CART_KEY = "aura-luxe-guest-cart";
const GUEST_BUY_NOW_KEY = "aura-luxe-guest-buy-now";
const GUEST_DRAFT_KEY = "aura-luxe-guest-checkout-draft";
const GUEST_CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface GuestCheckoutDraft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  town: string;
  region: string;
}

export interface GuestCartItem extends CartItem {
  product: Product;
  color?: ProductColor;
  quantity?: ProductQuantity;
}

interface GuestCartRecord {
  items: GuestCartItem[];
  expiresAt: string;
}

function writeGuestCartRecord(items: GuestCartItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  const record: GuestCartRecord = {
    items,
    expiresAt: new Date(Date.now() + GUEST_CART_TTL_MS).toISOString(),
  };

  window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(record));
}

function readGuestCartItems() {
  if (typeof window === "undefined") {
    return [] as GuestCartItem[];
  }

  try {
    const raw = window.localStorage.getItem(GUEST_CART_KEY);
    if (!raw) {
      return [] as GuestCartItem[];
    }

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      writeGuestCartRecord(parsed as GuestCartItem[]);
      return parsed as GuestCartItem[];
    }

    if (parsed && typeof parsed === "object") {
      const record = parsed as GuestCartRecord;
      if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
        window.localStorage.removeItem(GUEST_CART_KEY);
        return [] as GuestCartItem[];
      }

      return Array.isArray(record.items) ? record.items : ([] as GuestCartItem[]);
    }

    return [] as GuestCartItem[];
  } catch {
    window.localStorage.removeItem(GUEST_CART_KEY);
    return [] as GuestCartItem[];
  }
}

function makeGuestItemId(productId: string, colorId: string, quantityId: string) {
  return `guest-${productId}-${colorId}-${quantityId}`;
}

export function getGuestCartItems() {
  return readGuestCartItems();
}

export function saveGuestCartItems(items: GuestCartItem[]) {
  writeGuestCartRecord(items);
}

export function addGuestCartItem(
  product: Product,
  color: ProductColor | null,
  quantity: ProductQuantity | null,
  quantityOrdered: number,
) {
  const items = getGuestCartItems();
  const itemId = makeGuestItemId(
    product.id,
    color?.id || "no-color",
    quantity?.id || "no-quantity",
  );

  const existingItem = items.find((item) => item.id === itemId);
  const nextItem: GuestCartItem = {
    id: itemId,
    user_id: "",
    product_id: product.id,
    color_id: color?.id || "",
    quantity_id: quantity?.id || "",
    quantity_ordered: quantityOrdered,
    product,
    color: color || undefined,
    quantity: quantity || undefined,
  };

  if (existingItem) {
    const updatedItems = items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            quantity_ordered: item.quantity_ordered + quantityOrdered,
          }
        : item,
    );

    saveGuestCartItems(updatedItems);
    return updatedItems;
  }

  const updatedItems = [...items, nextItem];
  saveGuestCartItems(updatedItems);
  return updatedItems;
}

export function updateGuestCartItemQuantity(itemId: string, quantityOrdered: number) {
  const updatedItems = getGuestCartItems().map((item) =>
    item.id === itemId ? { ...item, quantity_ordered: quantityOrdered } : item,
  );
  saveGuestCartItems(updatedItems);
  return updatedItems;
}

export function removeGuestCartItem(itemId: string) {
  const updatedItems = getGuestCartItems().filter((item) => item.id !== itemId);
  saveGuestCartItems(updatedItems);
  return updatedItems;
}

export function clearGuestCartItems() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(GUEST_CART_KEY);
  window.localStorage.removeItem(GUEST_BUY_NOW_KEY);
}

export function saveGuestBuyNowItem(item: GuestCartItem) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(GUEST_BUY_NOW_KEY, JSON.stringify(item));
}

export function getGuestBuyNowItem() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(GUEST_BUY_NOW_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as GuestCartItem;
  } catch {
    return null;
  }
}

export function clearGuestBuyNowItem() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(GUEST_BUY_NOW_KEY);
}

export function saveGuestCheckoutDraft(draft: GuestCheckoutDraft) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(GUEST_DRAFT_KEY, JSON.stringify(draft));
}

export function getGuestCheckoutDraft() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(GUEST_DRAFT_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as GuestCheckoutDraft;
  } catch {
    return null;
  }
}

export function clearGuestCheckoutDraft() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(GUEST_DRAFT_KEY);
}
