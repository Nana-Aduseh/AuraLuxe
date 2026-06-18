"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { dedupeProfilesById, type AdminManagedProfile } from "@/lib/profile";
import { formatPrice } from "@/lib/currency";
import { createClient } from "@/lib/supabase/client";

interface AdminUsersResponse {
  currentUserId: string;
  users: AdminManagedProfile[];
}

interface UserOrder {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface AdminUsersProps {
  searchQuery?: string;
}

function getLoadUsersErrorMessage(error: unknown) {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "Unable to reach the admin users API. Restart the dev server, then rerun supabase-product-admin-setup.sql in Supabase if it still fails.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load users";
}

export default function AdminUsers({ searchQuery = "" }: AdminUsersProps) {
  const supabase = createClient();
  const [users, setUsers] = useState<AdminManagedProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userOrders, setUserOrders] = useState<Map<string, UserOrder[]>>(
    new Map(),
  );
  const [loadingOrders, setLoadingOrders] = useState<Set<string>>(new Set());

  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "GET",
        cache: "no-store",
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load users");
      }

      const data = payload as AdminUsersResponse;
      let fetchedUsers = dedupeProfilesById(data.users);
      
      // Fetch guest orders to show in admin dashboard
      const { data: guestOrders } = await supabase
        .from("orders")
        .select("id, total_amount, status, created_at, guest_email, guest_first_name, guest_last_name, guest_phone")
        .is("user_id", null)
        .order("created_at", { ascending: false });

      const newOrdersMap = new Map<string, UserOrder[]>();
      
      if (guestOrders && guestOrders.length > 0) {
        const guestUsersMap = new Map<string, AdminManagedProfile>();

        guestOrders.forEach((order) => {
          const identifier = order.guest_email || order.guest_phone || order.id;
          const guestId = `guest-${identifier}`;
          
          if (!guestUsersMap.has(guestId)) {
            guestUsersMap.set(guestId, {
              id: guestId,
              name: `${order.guest_first_name || 'Guest'} ${order.guest_last_name || ''}`.trim() || 'Guest Checkout',
              email: order.guest_email || 'No email',
              phone: order.guest_phone || '',
              is_admin: false,
            });
            newOrdersMap.set(guestId, []);
          }
          
          newOrdersMap.get(guestId)!.push({
            id: order.id,
            total_amount: order.total_amount,
            status: order.status,
            created_at: order.created_at,
          });
        });

        fetchedUsers = [...fetchedUsers, ...Array.from(guestUsersMap.values())];
      }

      setUsers(fetchedUsers);
      setCurrentUserId(data.currentUserId);
      
      if (newOrdersMap.size > 0) {
        setUserOrders((prev) => {
          const map = new Map(prev);
          newOrdersMap.forEach((orders, key) => map.set(key, orders));
          return map;
        });
      }
    } catch (loadError) {
      setError(getLoadUsersErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user) => {
      const haystack = [user.name, user.email, user.phone, user.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [searchQuery, users]);

  const loadUserOrders = async (userId: string) => {
    if (userOrders.has(userId)) {
      return;
    }

    setLoadingOrders((prev) => new Set(prev).add(userId));

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total_amount, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setUserOrders((prev) => new Map(prev).set(userId, data as UserOrder[]));
      }
    } catch (err) {
      console.error("Error loading orders:", err);
    } finally {
      setLoadingOrders((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleExpandUser = (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
    } else {
      setExpandedUserId(userId);
      if (!userId.startsWith('guest-')) {
        loadUserOrders(userId);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Users</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage users and view their order history
          </p>
        </div>
        <Button onClick={loadUsers} variant="outline">
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {filteredUsers.map((user) => {
          const isCurrentUser = user.id === currentUserId;
          const orders = userOrders.get(user.id) || [];
          const isLoading = loadingOrders.has(user.id);

          return (
            <div
              key={user.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              <div
                className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => handleExpandUser(user.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">
                          {user.name || "Unnamed user"}
                        </p>
                        {isCurrentUser && (
                          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">
                            You
                          </span>
                        )}
                        {user.is_admin && (
                          <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {user.email || "No email"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {user.id.startsWith('guest-') && (
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">Guest</span>
                  )}
                  <span className="text-gray-400 text-lg">
                    {expandedUserId === user.id ? "▼" : "▶"}
                  </span>
                </div>
              </div>

              {expandedUserId === user.id && (
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Order History
                  </h4>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                    </div>
                  ) : orders.length === 0 ? (
                    <p className="text-sm text-gray-600">No orders yet</p>
                  ) : (
                    <div className="space-y-2">
                      {orders.map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between p-3 bg-white rounded border border-gray-200 text-sm"
                        >
                          <div>
                            <p className="font-mono text-gray-900">
                              {order.id.slice(0, 8).toUpperCase()}
                            </p>
                            <p className="text-gray-600 text-xs">
                              {new Date(order.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-amber-600">
                              {formatPrice(order.total_amount)}
                            </p>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                order.status === "completed"
                                  ? "bg-green-100 text-green-700"
                                  : order.status === "processing"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!error && filteredUsers.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 px-6 py-12 text-center">
            <p className="text-gray-500">
              {users.length === 0
                ? "No synced users yet. Once someone signs in, they will appear here."
                : "No users match your search."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
