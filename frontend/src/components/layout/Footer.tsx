import { Link } from "@tanstack/react-router";
import { Truck, RotateCcw, Headphones, ShieldCheck, Facebook, Instagram, Twitter, Linkedin, MapPin, Mail, Phone, Leaf, CreditCard } from "lucide-react";
import { useUI } from "@/context/UIContext";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "@/lib/api-client";

function CookiePrefsLink() {
  const { openCookiePrefs } = useUI();
  return <button onClick={openCookiePrefs} className="underline hover:text-white">Cookie Preferences</button>;
}

const trust = [
  { icon: Truck, title: "FREE SHIPPING", desc: "On orders over $350" },
  { icon: RotateCcw, title: "EASY RETURNS", desc: "Hassle-free within 40 days" },
  { icon: Headphones, title: "24/7 SUPPORT", desc: "Dedicated customer service" },
  { icon: ShieldCheck, title: "SECURE CHECKOUT", desc: "Safe & trusted payments" },
];

export function Footer() {
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const topCategories = categories.slice(0, 6); // Show first 6 categories
  
  return (
    <footer className="mt-16 sm:mt-20">
      <div className="bg-surface border-y border-border">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-6 sm:py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {trust.map((t) => (
            <div key={t.title} className="flex items-center gap-2.5 sm:gap-3">
              <t.icon className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-xs sm:text-sm">{t.title}</p>
                <p className="text-[10px] sm:text-xs text-text-secondary">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#1A1A1A] text-white">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-10 sm:py-14 grid gap-8 sm:gap-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <Leaf className="h-5 w-5 sm:h-6 sm:w-6 text-primary-light" />
              <span className="font-display text-xl sm:text-2xl font-bold">CutHaven</span>
            </div>
            <p className="text-xs sm:text-sm text-white/70 mb-4 sm:mb-5 leading-relaxed">
              Your trusted source for premium outdoor and garden tools. Quality you can rely on.
            </p>
            <div className="flex gap-2.5 sm:gap-3">
              {[Facebook, Instagram, Twitter, Linkedin].map((Icon, i) => (
                <a key={i} target="_blank" rel="noopener noreferrer" href="#" className="h-8 w-8 sm:h-9 sm:w-9 rounded-full border border-white/20 flex items-center justify-center hover:bg-primary hover:border-primary transition-colors">
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-display text-base sm:text-lg text-primary-light mb-3 sm:mb-4">Categories</h4>
            <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-white/80">
              {topCategories.map((cat) => (
                <li key={cat.id}>
                  <Link to="/shop" search={{ category: cat.slug }} className="hover:text-white inline-block py-0.5">
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display text-base sm:text-lg text-primary-light mb-3 sm:mb-4">Store Policies</h4>
            <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-white/80">
              <li><Link to="/privacy-policy" className="hover:text-white inline-block py-0.5">Privacy Policy</Link></li>
              <li><Link to="/returns-refund-policy" className="hover:text-white inline-block py-0.5">Returns &amp; Refund Policy</Link></li>
              <li><Link to="/shipping-policy" className="hover:text-white inline-block py-0.5">Shipping Policy</Link></li>
              <li><Link to="/billing-terms-conditions" className="hover:text-white inline-block py-0.5">Billing Terms &amp; Conditions</Link></li>
              <li><Link to="/terms-of-service" className="hover:text-white inline-block py-0.5">Terms of Service</Link></li>
              <li><Link to="/order-cancellation-policy" className="hover:text-white inline-block py-0.5">Order Cancellation Policy</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-base sm:text-lg text-primary-light mb-3 sm:mb-4">Customer Care</h4>
            <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-white/80">
              <li><Link to="/about-us" className="hover:text-white inline-block py-0.5">About Us</Link></li>
              <li><Link to="/account/dashboard" className="hover:text-white inline-block py-0.5">My Account</Link></li>
              <li><Link to="/track-your-order" className="hover:text-white inline-block py-0.5">Track Your Order</Link></li>
              <li><Link to="/contact-us" hash="faqs" className="hover:text-white inline-block py-0.5">FAQs</Link></li>
              <li><Link to="/blog" className="hover:text-white inline-block py-0.5">Blog</Link></li>
              <li><Link to="/contact-us" className="hover:text-white inline-block py-0.5">Contact Us</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-base sm:text-lg text-primary-light mb-3 sm:mb-4">Contact Info</h4>
            <ul className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm text-white/80">
              <li className="flex gap-2"><MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 shrink-0 text-primary-light" /><span className="break-words">1633 S Industrial Way, Palmer, AK 99645</span></li>
              <li className="flex gap-2"><Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 shrink-0 text-primary-light" /><a href="mailto:support@cuthaven.com" className="hover:text-white break-all">support@cuthaven.com</a></li>
              <li className="flex gap-2"><Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 shrink-0 text-primary-light" /><a href="tel:+14062299045" className="hover:text-white">+1 (406) 229-9045</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto max-w-7xl px-3 sm:px-4 py-6 sm:py-8 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <p className="font-display text-base sm:text-lg mb-1">Subscribe to our newsletter</p>
              <p className="text-xs sm:text-sm text-white/70">Deals, guides, and new arrivals — no spam.</p>
            </div>
            <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="footer-email" className="sr-only">Email address</label>
              <input 
                id="footer-email"
                type="email" 
                required 
                placeholder="your@email.com" 
                aria-label="Email address for newsletter"
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-full bg-white/10 border border-white/20 text-xs sm:text-sm placeholder:text-white/50 focus:outline-none focus:border-primary-light" 
              />
              <button type="submit" className="btn-primary text-xs sm:text-sm px-4 sm:px-6 shrink-0" aria-label="Subscribe to newsletter">Subscribe</button>
            </form>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-5 flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-white/60">
            <p className="text-center md:text-left">© 2025 CutHaven. All Rights Reserved. · <CookiePrefsLink /></p>
            <div className="flex gap-1.5 sm:gap-2 items-center flex-wrap justify-center">
              {/* Visa */}
              <div className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded bg-white flex items-center justify-center h-6 sm:h-7 min-w-[40px] sm:min-w-[45px]">
                <span className="font-bold text-[#1A1F71] text-xs sm:text-sm tracking-tight">VISA</span>
              </div>
              
              {/* Mastercard */}
              <div className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded bg-white flex items-center justify-center h-6 sm:h-7 min-w-[40px] sm:min-w-[45px]">
                <div className="flex items-center gap-0.5">
                  <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-[#EB001B]"></div>
                  <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-[#FF5F00] -ml-1.5 sm:-ml-2"></div>
                </div>
              </div>
              
              {/* PayPal */}
              <div className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded bg-white flex items-center justify-center h-6 sm:h-7 min-w-[40px] sm:min-w-[45px]">
                <span className="font-bold text-[#003087] text-[10px] sm:text-xs tracking-tight">Pay</span>
                <span className="font-bold text-[#009CDE] text-[10px] sm:text-xs tracking-tight">Pal</span>
              </div>
              
              {/* Amex */}
              <div className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded bg-[#006FCF] flex items-center justify-center h-6 sm:h-7 min-w-[40px] sm:min-w-[45px]">
                <span className="font-bold text-white text-[9px] sm:text-[10px] tracking-tight">AMEX</span>
              </div>
              
              {/* Discover */}
              <div className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded bg-white flex items-center justify-center h-6 sm:h-7 min-w-[40px] sm:min-w-[45px]">
                <span className="font-bold text-[#FF6000] text-[8px] sm:text-[9px] tracking-tight">DISCOVER</span>
              </div>
              
              {/* Apple Pay */}
              <div className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded bg-white flex items-center justify-center h-6 sm:h-7 min-w-[40px] sm:min-w-[45px]">
                <span className="font-semibold text-black text-[9px] sm:text-[10px]">Apple Pay</span>
              </div>
              
              {/* Google Pay */}
              <div className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded bg-white flex items-center justify-center h-6 sm:h-7 min-w-[40px] sm:min-w-[45px]">
                <span className="font-medium text-[#5F6368] text-[9px] sm:text-[10px]">G Pay</span>
              </div>
              
              {/* Shop Pay */}
              <div className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded bg-[#5A31F4] flex items-center justify-center h-6 sm:h-7 min-w-[40px] sm:min-w-[45px]">
                <span className="font-bold text-white text-[9px] sm:text-[10px]">Shop Pay</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
