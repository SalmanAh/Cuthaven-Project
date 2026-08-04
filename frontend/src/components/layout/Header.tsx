import { Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Search, Heart, ShoppingBag, User, Menu, X, Leaf, LogOut, LayoutDashboard, ChevronDown } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useCartUI } from "@/context/CartUIContext";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/about-us", label: "About Us" },
  { to: "/blog", label: "Blog" },
  { to: "/contact-us", label: "Contact Us" },
  { to: "/track-your-order", label: "Track Order" },
] as const;

const popularSearches = ["Garden Tools", "Wrench Set", "Pruning Shears", "Cordless Drill", "Toolbox"];

export function Header() {
  const [annOpen, setAnnOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { count, subtotal } = useCart();
  const { count: wishCount } = useWishlist();
  const { setOpen: setCartOpen } = useCartUI();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    setMobileOpen(false);
    await logout();
    toast.success("Signed out");
    navigate({ to: "/" });
  };

  // Which dashboard link to show based on role
  const dashboardPath =
    user?.role === "admin" || user?.role === "product_manager"
      ? "/admin/dashboard"
      : user?.role === "store_manager"
        ? "/store-manager/dashboard"
        : "/account/dashboard";

  return (
    <>
      {annOpen && (
        <div className="bg-primary text-primary-foreground text-xs sm:text-sm">
          <div className="mx-auto max-w-7xl px-3 sm:px-4 py-2.5 sm:py-2 flex items-center justify-center gap-2 sm:gap-3 relative">
            <span className="text-center leading-relaxed">
              🚚 FREE SHIPPING ON ALL ORDERS OVER $350 —{" "}
              <Link to="/shop" className="underline underline-offset-2 font-semibold">
                Shop Now
              </Link>
            </span>
            <button
              onClick={() => setAnnOpen(false)}
              aria-label="Dismiss"
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100 p-1"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        </div>
      )}

      <header className={`sticky top-0 z-40 bg-surface transition-shadow ${scrolled ? "shadow-md" : "shadow-sm"}`}>
        <div className="mx-auto max-w-7xl px-3 sm:px-4 h-14 sm:h-16 md:h-20 flex items-center justify-between gap-2 sm:gap-4">
          <button
            className="lg:hidden -ml-1 sm:-ml-2 p-2 hover:bg-muted rounded-lg transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          <Link to="/" className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Leaf className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <span className="font-display text-xl sm:text-2xl font-bold text-primary">CutHaven</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-5 xl:gap-7 text-sm font-medium">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-foreground hover:text-primary transition-colors whitespace-nowrap"
                activeProps={{ className: "text-primary [&]:underline underline-offset-8 decoration-2 decoration-accent" }}
                activeOptions={{ exact: l.to === "/" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
            <button 
              onClick={() => setSearchOpen(true)} 
              aria-label="Search" 
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <Search className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            <Link 
              to="/wishlist" 
              className="relative p-2 hover:bg-muted rounded-lg transition-colors" 
              aria-label="Wishlist"
            >
              <Heart className="h-4 w-4 sm:h-5 sm:w-5" />
              {wishCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] rounded-full bg-destructive text-white text-[9px] sm:text-[10px] font-bold flex items-center justify-center px-0.5 sm:px-1">
                  {wishCount > 99 ? '99+' : wishCount}
                </span>
              )}
            </Link>

            <button
              onClick={() => setCartOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 p-2 hover:bg-muted rounded-lg transition-colors relative"
              aria-label="Cart"
            >
              <div className="relative">
                <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] rounded-full bg-primary text-primary-foreground text-[9px] sm:text-[10px] font-bold flex items-center justify-center px-0.5 sm:px-1">
                  {count > 99 ? '99+' : count}
                </span>
              </div>
              <span className="hidden xl:inline text-xs text-text-secondary whitespace-nowrap">
                {count} items — <span className="text-accent font-semibold">${subtotal.toFixed(2)}</span>
              </span>
            </button>

            {/* ── Auth area ── */}
            {user ? (
              // Logged in — show name + dropdown
              <div className="relative hidden lg:block" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors"
                  aria-label="Account menu"
                >
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    {user.firstName[0]}{user.lastName[0]}
                  </div>
                  <span className="hidden xl:inline">{user.firstName}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-surface rounded-xl border border-border shadow-lg py-1.5 z-50">
                    <div className="px-4 py-2 border-b border-border">
                      <p className="font-semibold text-sm">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-text-secondary truncate">{user.email}</p>
                    </div>
                    <Link
                      to={dashboardPath}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                    >
                      <LayoutDashboard className="h-4 w-4 text-text-secondary" />
                      {user.role === "admin"
                        ? "Admin Panel"
                        : user.role === "store_manager"
                        ? "Manager Panel"
                        : user.role === "product_manager"
                        ? "Product Manager Panel"
                        : "My Account"}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Logged out — show Login / Register
              <Link
                to="/account/login"
                className="hidden lg:flex items-center gap-1 text-sm font-medium hover:text-primary"
              >
                <User className="h-4 w-4" /> <span className="hidden xl:inline">Login / Register</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Search overlay ── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setSearchOpen(false)}>
          <div className="bg-surface w-full py-6 sm:py-8 px-3 sm:px-4" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto max-w-3xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim();
                  if (!q) return;
                  setSearchOpen(false);
                  navigate({ to: "/shop", search: { q } });
                }}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <Search className="h-4 w-4 sm:h-5 sm:w-5 text-text-secondary flex-shrink-0" />
                  <input
                    name="q"
                    autoFocus
                    placeholder="Search for products..."
                    className="flex-1 text-base sm:text-lg py-2 sm:py-3 outline-none bg-transparent"
                  />
                  <button type="submit" className="btn-primary text-xs sm:text-sm px-3 sm:px-4 py-2 shrink-0">Search</button>
                  <button type="button" onClick={() => setSearchOpen(false)} className="p-1.5 sm:p-2 shrink-0" aria-label="Close">
                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
              </form>
              <div className="mt-4 sm:mt-6">
                <p className="text-[10px] sm:text-xs uppercase tracking-wide text-text-secondary mb-2 sm:mb-3">Popular searches</p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {popularSearches.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSearchOpen(false); navigate({ to: "/shop", search: { q: s } }); }}
                      className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-border text-xs sm:text-sm hover:border-primary hover:text-primary transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside
            className="bg-surface h-full w-[280px] sm:w-[320px] p-4 sm:p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5 sm:mb-6">
              <span className="font-display text-lg sm:text-xl font-bold text-primary">CutHaven</span>
              <button 
                onClick={() => setMobileOpen(false)} 
                aria-label="Close"
                className="p-1.5 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-0.5">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMobileOpen(false)}
                  className="py-3 px-2 border-b border-border text-sm sm:text-base font-medium hover:bg-muted rounded-lg transition-colors"
                >
                  {l.label}
                </Link>
              ))}

              {user ? (
                <>
                  <div className="py-3 px-2 border-b border-border">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm font-bold shrink-0">
                        {user.firstName[0]}{user.lastName[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-text-secondary truncate">{user.email}</p>
                      </div>
                    </div>
                  </div>
                  <Link
                    to={dashboardPath}
                    onClick={() => setMobileOpen(false)}
                    className="py-3 px-2 border-b border-border text-sm sm:text-base font-medium flex items-center gap-2 hover:bg-muted rounded-lg transition-colors"
                  >
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {user.role === "admin"
                        ? "Admin Panel"
                        : user.role === "store_manager"
                        ? "Manager Panel"
                        : user.role === "product_manager"
                        ? "Product Manager Panel"
                        : "My Account"}
                    </span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="py-3 px-2 border-b border-border text-sm sm:text-base font-medium text-destructive flex items-center gap-2 w-full text-left hover:bg-destructive/5 rounded-lg transition-colors"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  to="/account/login"
                  onClick={() => setMobileOpen(false)}
                  className="py-3 px-2 border-b border-border text-sm sm:text-base font-medium flex items-center gap-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <User className="h-4 w-4 shrink-0" />
                  Login / Register
                </Link>
              )}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
