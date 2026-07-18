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
        <div className="bg-primary text-primary-foreground text-xs md:text-sm">
          <div className="mx-auto max-w-7xl px-4 py-2 flex items-center justify-center gap-3 relative">
            <span>
              🚚 FREE SHIPPING ON ALL ORDERS OVER $350 —{" "}
              <Link to="/shop" className="underline underline-offset-2 font-semibold">
                Shop Now
              </Link>
            </span>
            <button
              onClick={() => setAnnOpen(false)}
              aria-label="Dismiss"
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <header className={`sticky top-0 z-40 bg-surface transition-shadow ${scrolled ? "shadow-md" : "shadow-sm"}`}>
        <div className="mx-auto max-w-7xl px-4 h-16 md:h-20 flex items-center justify-between gap-4">
          <button
            className="md:hidden -ml-2 p-2"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="font-display text-2xl font-bold text-primary">CutHaven</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-foreground hover:text-primary transition-colors"
                activeProps={{ className: "text-primary [&]:underline underline-offset-8 decoration-2 decoration-accent" }}
                activeOptions={{ exact: l.to === "/" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 md:gap-4">
            <button onClick={() => setSearchOpen(true)} aria-label="Search" className="p-2 hover:text-primary">
              <Search className="h-5 w-5" />
            </button>

            <Link to="/wishlist" className="relative p-2 hover:text-primary" aria-label="Wishlist">
              <Heart className="h-5 w-5" />
              {wishCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {wishCount}
                </span>
              )}
            </Link>

            <button
              onClick={() => setCartOpen(true)}
              className="flex items-center gap-2 p-2 hover:text-primary relative"
              aria-label="Cart"
            >
              <div className="relative">
                <ShoppingBag className="h-5 w-5" />
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                  {count}
                </span>
              </div>
              <span className="hidden lg:inline text-xs text-text-secondary">
                {count} items — <span className="text-accent font-semibold">${subtotal.toFixed(2)}</span>
              </span>
            </button>

            {/* ── Auth area ── */}
            {user ? (
              // Logged in — show name + dropdown
              <div className="relative hidden md:block" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors"
                  aria-label="Account menu"
                >
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    {user.firstName[0]}{user.lastName[0]}
                  </div>
                  <span className="hidden lg:inline">{user.firstName}</span>
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
                className="hidden md:flex items-center gap-1 text-sm font-medium hover:text-primary"
              >
                <User className="h-4 w-4" /> Login / Register
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Search overlay ── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setSearchOpen(false)}>
          <div className="bg-surface w-full py-8 px-4" onClick={(e) => e.stopPropagation()}>
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
                <div className="flex items-center gap-3">
                  <Search className="h-5 w-5 text-text-secondary" />
                  <input
                    name="q"
                    autoFocus
                    placeholder="Search for products..."
                    className="flex-1 text-lg py-3 outline-none bg-transparent"
                  />
                  <button type="submit" className="btn-primary text-sm px-4 py-2">Search</button>
                  <button type="button" onClick={() => setSearchOpen(false)} className="p-2" aria-label="Close">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </form>
              <div className="mt-6">
                <p className="text-xs uppercase tracking-wide text-text-secondary mb-3">Popular searches</p>
                <div className="flex flex-wrap gap-2">
                  {popularSearches.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSearchOpen(false); navigate({ to: "/shop", search: { q: s } }); }}
                      className="px-3 py-1.5 rounded-full border border-border text-sm hover:border-primary hover:text-primary"
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
        <div className="fixed inset-0 z-50 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)}>
          <aside
            className="bg-surface h-full w-[85%] max-w-sm p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <span className="font-display text-xl font-bold text-primary">CutHaven</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMobileOpen(false)}
                  className="py-3 border-b border-border text-base font-medium"
                >
                  {l.label}
                </Link>
              ))}

              {user ? (
                <>
                  <div className="py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                        {user.firstName[0]}{user.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-text-secondary">{user.email}</p>
                      </div>
                    </div>
                  </div>
                  <Link
                    to={dashboardPath}
                    onClick={() => setMobileOpen(false)}
                    className="py-3 border-b border-border text-base font-medium flex items-center gap-2"
                  >
                    <LayoutDashboard className="h-4 w-4" />
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
                    className="py-3 border-b border-border text-base font-medium text-destructive flex items-center gap-2 w-full text-left"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  to="/account/login"
                  onClick={() => setMobileOpen(false)}
                  className="py-3 border-b border-border text-base font-medium"
                >
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
