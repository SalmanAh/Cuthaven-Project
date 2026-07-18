import { Link } from "@tanstack/react-router";
import { Truck, RotateCcw, Headphones, ShieldCheck, Facebook, Instagram, Twitter, Linkedin, MapPin, Mail, Phone, Leaf, CreditCard } from "lucide-react";
import { useUI } from "@/context/UIContext";

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
  return (
    <footer className="mt-20">
      <div className="bg-surface border-y border-border">
        <div className="mx-auto max-w-7xl px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {trust.map((t) => (
            <div key={t.title} className="flex items-center gap-3">
              <t.icon className="h-8 w-8 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-sm">{t.title}</p>
                <p className="text-xs text-text-secondary">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#1A1A1A] text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Leaf className="h-6 w-6 text-primary-light" />
              <span className="font-display text-2xl font-bold">CutHaven</span>
            </div>
            <p className="text-sm text-white/70 mb-5 leading-relaxed">
              Your trusted source for premium outdoor and garden tools. Quality you can rely on.
            </p>
            <div className="flex gap-3">
              {[Facebook, Instagram, Twitter, Linkedin].map((Icon, i) => (
                <a key={i} target="_blank" rel="noopener noreferrer" href="#" className="h-9 w-9 rounded-full border border-white/20 flex items-center justify-center hover:bg-primary hover:border-primary transition-colors">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-display text-lg text-primary-light mb-4">Store Policies</h4>
            <ul className="space-y-2.5 text-sm text-white/80">
              <li><Link to="/privacy-policy" className="hover:text-white">Privacy Policy</Link></li>
              <li><Link to="/returns-refund-policy" className="hover:text-white">Returns &amp; Refund Policy</Link></li>
              <li><Link to="/shipping-policy" className="hover:text-white">Shipping Policy</Link></li>
              <li><Link to="/billing-terms-conditions" className="hover:text-white">Billing Terms &amp; Conditions</Link></li>
              <li><Link to="/terms-of-service" className="hover:text-white">Terms of Service</Link></li>
              <li><Link to="/order-cancellation-policy" className="hover:text-white">Order Cancellation Policy</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-lg text-primary-light mb-4">Customer Care</h4>
            <ul className="space-y-2.5 text-sm text-white/80">
              <li><Link to="/about-us" className="hover:text-white">About Us</Link></li>
              <li><Link to="/account/dashboard" className="hover:text-white">My Account</Link></li>
              <li><Link to="/track-your-order" className="hover:text-white">Track Your Order</Link></li>
              <li><Link to="/contact-us" hash="faqs" className="hover:text-white">FAQs</Link></li>
              <li><Link to="/blog" className="hover:text-white">Blog</Link></li>
              <li><Link to="/contact-us" className="hover:text-white">Contact Us</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-lg text-primary-light mb-4">Contact Info</h4>
            <ul className="space-y-3 text-sm text-white/80">
              <li className="flex gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary-light" />1633 S Industrial Way, Palmer, AK 99645</li>
              <li className="flex gap-2"><Mail className="h-4 w-4 mt-0.5 shrink-0 text-primary-light" />support@cuthaven.com</li>
              <li className="flex gap-2"><Phone className="h-4 w-4 mt-0.5 shrink-0 text-primary-light" />+1 (406) 229-9045</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto max-w-7xl px-4 py-8 grid md:grid-cols-2 gap-6 items-center">
            <div>
              <p className="font-display text-lg mb-1">Subscribe to our newsletter</p>
              <p className="text-sm text-white/70">Deals, guides, and new arrivals — no spam.</p>
            </div>
            <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <input type="email" required placeholder="your@email.com" className="flex-1 px-4 py-3 rounded-full bg-white/10 border border-white/20 text-sm placeholder:text-white/50 focus:outline-none focus:border-primary-light" />
              <button className="btn-primary">Subscribe</button>
            </form>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto max-w-7xl px-4 py-5 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-white/60">
            <p>© 2025 CutHaven. All Rights Reserved. · <CookiePrefsLink /></p>
            <div className="flex gap-3 items-center flex-wrap justify-center">
              {/* Visa */}
              <div className="px-3 py-1.5 rounded bg-white flex items-center justify-center h-8 min-w-[50px]">
                <span className="font-bold text-[#1A1F71] text-base tracking-tight">VISA</span>
              </div>
              
              {/* Mastercard */}
              <div className="px-3 py-1.5 rounded bg-white flex items-center justify-center h-8 min-w-[50px]">
                <div className="flex items-center gap-0.5">
                  <div className="w-4 h-4 rounded-full bg-[#EB001B]"></div>
                  <div className="w-4 h-4 rounded-full bg-[#FF5F00] -ml-2"></div>
                </div>
              </div>
              
              {/* PayPal */}
              <div className="px-3 py-1.5 rounded bg-white flex items-center justify-center h-8 min-w-[50px]">
                <span className="font-bold text-[#003087] text-xs tracking-tight">Pay</span>
                <span className="font-bold text-[#009CDE] text-xs tracking-tight">Pal</span>
              </div>
              
              {/* Amex */}
              <div className="px-3 py-1.5 rounded bg-[#006FCF] flex items-center justify-center h-8 min-w-[50px]">
                <span className="font-bold text-white text-xs tracking-tight">AMEX</span>
              </div>
              
              {/* Discover */}
              <div className="px-3 py-1.5 rounded bg-white flex items-center justify-center h-8 min-w-[50px]">
                <span className="font-bold text-[#FF6000] text-xs tracking-tight">DISCOVER</span>
              </div>
              
              {/* Apple Pay */}
              <div className="px-3 py-1.5 rounded bg-white flex items-center justify-center h-8 min-w-[50px]">
                <span className="font-semibold text-black text-xs">Apple Pay</span>
              </div>
              
              {/* Google Pay */}
              <div className="px-3 py-1.5 rounded bg-white flex items-center justify-center h-8 min-w-[50px]">
                <span className="font-medium text-[#5F6368] text-xs">G Pay</span>
              </div>
              
              {/* Shop Pay */}
              <div className="px-3 py-1.5 rounded bg-[#5A31F4] flex items-center justify-center h-8 min-w-[50px]">
                <span className="font-bold text-white text-xs">Shop Pay</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
