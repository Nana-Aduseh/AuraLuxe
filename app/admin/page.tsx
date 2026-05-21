"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import AdminProducts from "@/components/admin/admin-products";
import AdminOrders from "@/components/admin/admin-orders";
import AdminUsers from "@/components/admin/admin-users";
import { LogOut } from "lucide-react";

type Tab = "products" | "orders" | "users";

export default function AdminPage() {
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(
    null,
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<Tab>("orders");
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const response = await fetch("/api/admin/access", {
          method: "GET",
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/auth/login");
          return;
        }

        const payload = await response.json();
        setUser(payload.user ?? null);
        setIsAdmin(payload.isAdmin === true);
      } finally {
        setAuthChecked(true);
        setLoading(false);
      }
    };

    checkAdmin();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen px-6">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md w-full text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Admin Access Required
          </h1>
          <p className="text-gray-600 mb-6">
            {authChecked
              ? "This account is signed in, but it does not currently have admin access."
              : "Checking your account access..."}
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild variant="outline">
              <Link href="/">Back Home</Link>
            </Button>
            <Button
              asChild
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Link href="/auth/login">Login</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                AuraLuxe Admin
              </h1>
              <p className="text-sm text-gray-600 mt-1">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab("orders")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "orders"
                  ? "border-amber-600 text-amber-600"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              Orders
            </button>
            <button
              onClick={() => setActiveTab("products")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "products"
                  ? "border-amber-600 text-amber-600"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              Products
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "users"
                  ? "border-amber-600 text-amber-600"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              Users
            </button>
          </div>

          <div className="pb-4 flex flex-col md:flex-row md:items-center gap-3">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search admin records..."
              className="w-full md:max-w-md rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            />
            <select
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value as Tab)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="orders">Orders</option>
              <option value="products">Products</option>
              <option value="users">Users</option>
            </select>
            <Button
              onClick={() => {
                setSearchQuery(searchInput);
                setActiveTab(searchFilter);
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Search
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "orders" && (
          <AdminOrders
            searchQuery={searchFilter === "orders" ? searchQuery : ""}
          />
        )}
        {activeTab === "products" && (
          <AdminProducts
            searchQuery={searchFilter === "products" ? searchQuery : ""}
          />
        )}
        {activeTab === "users" && (
          <AdminUsers
            searchQuery={searchFilter === "users" ? searchQuery : ""}
          />
        )}
      </div>
    </main>
  );
}
