"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { ShoppingCart, LogOut, Menu, X, ArrowLeft, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getGuestCartItems, clearGuestCartItems } from "@/lib/guest-cart";

interface HeaderProps {
  onSearch?: (query: string) => void;
}

/**
 * SmartLink provides immediate visual feedback for header navigation.
 */
function SmartLink({ href, children, className, onClick }: any) {
  return (
    <Link href={href} className={className} onClick={onClick}>
      <LinkIndicator>{children}</LinkIndicator>
    </Link>
  );
}

function LinkIndicator({ children }: any) {
  const { pending } = useLinkStatus();
  return (
    <span className="relative inline-flex items-center gap-1">
      {children}
      {pending && (
        <Loader2 className="w-3 h-3 animate-spin text-primary transition-opacity" />
      )}
    </span>
  );
}

export default function Header({ onSearch }: HeaderProps) {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [cartCount, setCartCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const isHomePage = pathname === "/";

  // Define these at the top level of the effect to be accessible for cleanup
  let channel: any = null;
  let storageUnsubscribe: (() => void) | null = null;
  let isActive = true;

  useEffect(() => {
    const loadUserDataAndCount = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Load user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single();

        if (profile) {
          setUserProfile(profile);
        }

        const adminAccessPromise = fetch("/api/admin/access", {
          method: "GET",
          cache: "no-store",
        })
          .then(async (response) => {
            if (!response.ok) {
              return false;
            }

            const payload = await response.json();
            return payload.isAdmin === true;
          })
          .catch(() => false);

        const [{ data }, userIsAdmin] = await Promise.all([
          supabase
            .from("cart_items")
            .select("quantity_ordered")
            .eq("user_id", user.id),
          adminAccessPromise,
        ]);

        const count = data?.length || 0;
        setCartCount(count);
        setIsAdmin(userIsAdmin);
      } else {
        // For guests, calculate count from local storage
        const guestItems = getGuestCartItems();
        const count = guestItems.length;
        setCartCount(count);
        setIsAdmin(false);
        setUserProfile(null);
      }

      // Always refresh listener when user state is determined
      if (isActive) setupCartListener();
      setLoading(false);
    };

    loadUserDataAndCount();

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUserDataAndCount();
    });

    // Listen for manual refresh events from mutations elsewhere in the app
    const handleManualRefresh = () => loadUserDataAndCount();
    window.addEventListener("aura-luxe-cart-updated", handleManualRefresh);
    // For backward compatibility with existing guest cart logic
    window.addEventListener("aura-luxe-guest-cart-changed", handleManualRefresh);

    const setupCartListener = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isActive) return;

      // Clean up previous listeners before starting new ones
      if (channel) supabase.removeChannel(channel);
      if (storageUnsubscribe) storageUnsubscribe();

      if (user) {
        channel = supabase
          .channel(`cart-changes-${user.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "cart_items",
              filter: `user_id=eq.${user.id}`,
            },
            async () => {
              // Refetch cart count when changes occur
              const { data } = await supabase
                .from("cart_items")
                .select("quantity_ordered")
                .eq("user_id", user.id);

              const count = data?.length || 0;
              setCartCount(count);
            },
          )
          .subscribe();
      } else {
        // For guest users, listen to custom guest cart change events
        const handleGuestCartChange = () => {
          const guestItems = getGuestCartItems();
          const guestCount = guestItems.length;
          setCartCount(guestCount);
        };

        window.addEventListener("aura-luxe-guest-cart-changed", handleGuestCartChange as EventListener);

        storageUnsubscribe = () => {
          window.removeEventListener("aura-luxe-guest-cart-changed", handleGuestCartChange as EventListener);
        };
      }
    };

    return () => {
      isActive = false;
      authSubscription.unsubscribe();
      window.removeEventListener("aura-luxe-cart-updated", handleManualRefresh);
      window.removeEventListener("aura-luxe-guest-cart-changed", handleManualRefresh);
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (storageUnsubscribe) {
        storageUnsubscribe();
      }
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setCartCount(0);
    router.push("/");
    window.location.reload();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/extensions?search=${encodeURIComponent(searchQuery)}`);
      setMobileMenuOpen(false);
      setSearchQuery("");
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border/30 shadow-md">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <Image
              src="/aura-luxe-logo.png"
              alt="AuraLuxe Hair"
              width={150}
              height={64}
              className="h-16 w-auto object-contain"
              priority
            />
            <span className="font-semibold text-foreground text-xs sm:text-sm md:text-base">
              AuraLuxe Hair
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex gap-8 items-center">
            <SmartLink
              href="/"
              className="text-foreground/80 hover:text-primary transition-colors font-medium text-sm"
            >
              Home
            </SmartLink>
            <SmartLink
              href="/extensions"
              className="text-foreground/80 hover:text-primary transition-colors font-medium text-sm"
            >
              Extensions
            </SmartLink>
            <SmartLink
              href="/products"
              className="text-foreground/80 hover:text-primary transition-colors font-medium text-sm"
            >
              Products
            </SmartLink>
            {user && (
              <SmartLink
                href="/orders"
                className="text-foreground/80 hover:text-primary transition-colors font-medium text-sm"
              >
                Orders
              </SmartLink>
            )}
            <SmartLink
              href="/about"
              className="text-foreground/80 hover:text-primary transition-colors font-medium text-sm"
            >
              About
            </SmartLink>
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Admin Link - Desktop */}
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="hidden md:inline-flex"
              >
                <Link href="/admin">Admin</Link>
              </Button>
            )}

            {/* Cart */}
            <Link href="/cart" className="relative">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                    {cartCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Auth - Desktop */}
            <div className="hidden md:flex items-center gap-2">
              {loading ? (
                <div className="w-20 h-10 bg-muted rounded animate-pulse" />
              ) : user ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-foreground text-xs md:text-sm truncate max-w-[120px]"
                    title={userProfile?.name || user.email}
                  >
                    {userProfile?.name
                      ? userProfile.name.split(" ")[0]
                      : user.email?.split("@")[0]}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button
                  asChild
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                >
                  <Link href="/auth/login">Sign In</Link>
                </Button>
              )}
            </div>

            {/* Mobile Menu Button - Always Visible on Mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden pb-4 border-t border-border/20">
            {/* Mobile Search */}
            <div className="py-3">
              <form onSubmit={handleSearch} className="px-4">
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-sm"
                />
              </form>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex flex-col gap-2 py-2">
              <Link
                href="/"
                className="text-foreground/80 hover:text-primary transition-colors font-medium text-sm px-4 py-2 rounded hover:bg-muted"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                href="/extensions"
                className="text-foreground/80 hover:text-primary transition-colors font-medium text-sm px-4 py-2 rounded hover:bg-muted"
                onClick={() => setMobileMenuOpen(false)}
              >
                Extensions
              </Link>
              <Link
                href="/products"
                className="text-foreground/80 hover:text-primary transition-colors font-medium text-sm px-4 py-2 rounded hover:bg-muted"
                onClick={() => setMobileMenuOpen(false)}
              >
                Products
              </Link>
              {user && (
                <Link
                  href="/orders"
                  className="text-foreground/80 hover:text-primary transition-colors font-medium text-sm px-4 py-2 rounded hover:bg-muted"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Orders
                </Link>
              )}
              <Link
                href="/about"
                className="text-foreground/80 hover:text-primary transition-colors font-medium text-sm px-4 py-2 rounded hover:bg-muted"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-foreground/80 hover:text-primary transition-colors font-medium text-sm px-4 py-2 rounded hover:bg-muted"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Admin
                </Link>
              )}
            </nav>

            {/* Mobile Auth */}
            <div className="border-t border-border/20 pt-3 mt-3">
              {loading ? (
                <div className="w-full h-10 bg-muted rounded animate-pulse" />
              ) : user ? (
                <div className="flex flex-col gap-2 px-4">
                  <div className="text-sm font-medium text-foreground truncate">
                    {user.email}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              ) : (
                <Button
                  asChild
                  size="sm"
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
