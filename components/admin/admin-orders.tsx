"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { formatPrice } from "@/lib/currency";

interface OrderWithDetails {
  id: string;
  user_id: string;
  total_amount: number;
  status: string;
  order_type: string;
  confirmation_status: string;
  delivery_status: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  user_name?: string;
  user_email?: string;
  order_items?: OrderItem[];
}

interface OrderItem {
  id: string;
  product_id: string;
  quantity_ordered: number;
  price_at_purchase: number;
  product_name?: string;
  color_name?: string;
}

interface AdminOrdersProps {
  searchQuery?: string;
}

export default function AdminOrders({ searchQuery = "" }: AdminOrdersProps) {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<
    "all" | "pending" | "confirmed" | "shipped"
  >("all");
  const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest");

  useEffect(() => {
    loadOrders();
  }, []);

  const updateOrderState = (
    orderId: string,
    fields: Partial<Pick<OrderWithDetails, "confirmation_status" | "delivery_status">>,
  ) => {
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, ...fields } : order,
      ),
    );
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/orders", {
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        console.error("Unauthorized admin order request");
        setLoading(false);
        return;
      }

      const payload = await response.json();

      if (!response.ok) {
        console.error("Error loading orders:", payload?.error);
        setLoading(false);
        return;
      }

      const data = payload.orders as OrderWithDetails[];

      console.log("Orders loaded:", data);

      if (data) {
        setOrders(data);
      }
    } catch (err) {
      console.error("Exception in loadOrders:", err);
    }
    setLoading(false);
  };

  const handleConfirmationStatusUpdate = async (
    orderId: string,
    newStatus: string,
  ) => {
    const response = await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation_status: newStatus }),
    })

    if (response.ok) {
      updateOrderState(orderId, { confirmation_status: newStatus });
    } else {
      alert("Error updating confirmation status");
    }
  };

  const handleDeliveryStatusUpdate = async (
    orderId: string,
    newStatus: string,
  ) => {
    const response = await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery_status: newStatus || null }),
    })

    if (response.ok) {
      updateOrderState(orderId, { delivery_status: newStatus || null });
    } else {
      alert("Error updating delivery status");
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (filterTab === "all") return true;
    if (filterTab === "pending")
      return order.confirmation_status === "not_confirmed";
    if (filterTab === "confirmed")
      return order.confirmation_status === "confirmed";
    if (filterTab === "shipped")
      return (
        order.delivery_status === "sent" || order.delivery_status === "received"
      );
    return true;
  });

  const query = searchQuery.trim().toLowerCase();

  const searchedOrders = filteredOrders.filter((order) => {
    if (!query) return true;

    const orderItemText = (order.order_items || [])
      .map((item) => `${item.product_name || ""} ${item.color_name || ""}`)
      .join(" ");

    const haystack = [
      order.id,
      order.user_name,
      order.user_email,
      order.status,
      order.confirmation_status,
      order.delivery_status,
      orderItemText,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });

  const visibleOrders = [...searchedOrders].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();

    return dateSort === "newest" ? bTime - aTime : aTime - bTime;
  });

  const groupedOrders = visibleOrders.reduce<
    Array<{ dateLabel: string; orders: OrderWithDetails[] }>
  >((groups, order) => {
    const orderDate = format(new Date(order.created_at), "EEEE do MMMM yyyy");
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.dateLabel === orderDate) {
      lastGroup.orders.push(order);
      return groups;
    }

    groups.push({ dateLabel: orderDate, orders: [order] });
    return groups;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Orders</h2>

      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm font-medium text-gray-700">
          Sort by date:
        </label>
        <select
          value={dateSort}
          onChange={(e) => setDateSort(e.target.value as "newest" | "oldest")}
          className="text-sm px-3 py-2 rounded border border-gray-300 bg-white"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => {
            setFilterTab("all");
          }}
          className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
            filterTab === "all"
              ? "bg-amber-600 text-white border-amber-600"
              : "bg-white text-gray-700 border-gray-200 hover:border-amber-300"
          }`}
        >
          All Orders ({orders.length})
        </button>
        <button
          onClick={() => {
            setFilterTab("pending");
          }}
          className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
            filterTab === "pending"
              ? "bg-amber-600 text-white border-amber-600"
              : "bg-white text-gray-700 border-gray-200 hover:border-amber-300"
          }`}
        >
          Pending (
          {
            orders.filter((o) => o.confirmation_status === "not_confirmed")
              .length
          }
          )
        </button>
        <button
          onClick={() => {
            setFilterTab("confirmed");
          }}
          className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
            filterTab === "confirmed"
              ? "bg-amber-600 text-white border-amber-600"
              : "bg-white text-gray-700 border-gray-200 hover:border-amber-300"
          }`}
        >
          Confirmed (
          {orders.filter((o) => o.confirmation_status === "confirmed").length})
        </button>
        <button
          onClick={() => {
            setFilterTab("shipped");
          }}
          className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
            filterTab === "shipped"
              ? "bg-amber-600 text-white border-amber-600"
              : "bg-white text-gray-700 border-gray-200 hover:border-amber-300"
          }`}
        >
          Shipped (
          {
            orders.filter(
              (o) =>
                o.delivery_status === "sent" ||
                o.delivery_status === "received",
            ).length
          }
          )
        </button>
      </div>

      {visibleOrders.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No orders match this view</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedOrders.map((group) => (
            <div key={group.dateLabel} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {group.dateLabel}
              </h3>
              <div className="space-y-4">
                {group.orders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                  >
                    <div
                      className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setExpandedOrder(
                          expandedOrder === order.id ? null : order.id,
                        )
                      }
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {order.user_name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {order.user_email}
                            </p>
                          </div>
                          <div className="hidden md:block">
                            <p className="text-sm text-gray-600">
                              Order: {order.id.slice(0, 8).toUpperCase()}
                            </p>
                            <p className="text-sm text-gray-600">
                              {new Date(order.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="hidden md:block">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                order.order_type === "delivery"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-purple-100 text-purple-700"
                              }`}
                            >
                              {order.order_type === "delivery"
                                ? "🚚 Delivery"
                                : "📍 Pickup"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap justify-end">
                        <div className="text-right">
                          <p className="font-semibold text-amber-600">
                            {formatPrice(order.total_amount)}
                          </p>
                        </div>
                        <span className="text-gray-400">
                          {expandedOrder === order.id ? "▼" : "▶"}
                        </span>
                      </div>
                    </div>

                    {expandedOrder === order.id && (
                      <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Confirmation Status
                            </label>
                            <select
                              value={order.confirmation_status}
                              onChange={(e) =>
                                handleConfirmationStatusUpdate(
                                  order.id,
                                  e.target.value,
                                )
                              }
                              className={`w-full text-sm px-3 py-2 rounded border font-medium transition-colors ${
                                order.confirmation_status === "confirmed"
                                  ? "bg-green-100 border-green-300 text-green-700"
                                  : "bg-yellow-100 border-yellow-300 text-yellow-700"
                              }`}
                            >
                              <option value="not_confirmed">Not Confirmed</option>
                              <option value="confirmed">Confirmed</option>
                            </select>
                          </div>

                          {order.confirmation_status === "confirmed" && (
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Delivery Status
                              </label>
                              <select
                                value={order.delivery_status || ""}
                                onChange={(e) =>
                                  handleDeliveryStatusUpdate(
                                    order.id,
                                    e.target.value,
                                  )
                                }
                                className={`w-full text-sm px-3 py-2 rounded border font-medium transition-colors ${
                                  order.delivery_status === "received"
                                    ? "bg-green-100 border-green-300 text-green-700"
                                    : order.delivery_status === "sent"
                                      ? "bg-blue-100 border-blue-300 text-blue-700"
                                      : "bg-gray-100 border-gray-300 text-gray-700"
                                }`}
                              >
                                <option value="">Mark as Sent/Received</option>
                                <option value="sent">Sent</option>
                                <option value="received">Received</option>
                              </select>
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Delivery Method
                            </label>
                            <div
                              className={`w-full text-sm px-3 py-2 rounded border font-medium text-center ${
                                order.order_type === "delivery"
                                  ? "bg-blue-100 border-blue-300 text-blue-700"
                                  : "bg-purple-100 border-purple-300 text-purple-700"
                              }`}
                            >
                              {order.order_type === "delivery"
                                ? "🚚 Delivery"
                                : "📍 Pickup"}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Completed At
                            </label>
                            <div className="w-full text-sm px-3 py-2 rounded border font-medium text-center bg-gray-100 border-gray-300 text-gray-700">
                              {order.completed_at
                                ? format(new Date(order.completed_at), "PPpp")
                                : "Pending payment"}
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3">
                            Order Items ({order.order_items?.length || 0})
                          </h4>
                          <div className="space-y-2">
                            {order.order_items && order.order_items.length > 0 ? (
                              order.order_items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between text-sm text-gray-600 p-2 bg-white rounded"
                                >
                                  <span>
                                    {item.product_name ||
                                      `Product ID: ${item.product_id}`} {" "}
                                    {item.color_name && `(${item.color_name})`}
                                  </span>
                                  <span>
                                    {item.quantity_ordered}x {" "}
                                    {formatPrice(item.price_at_purchase)}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-orange-600 p-2 bg-orange-50 rounded">
                                No items found for this order
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
