import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Phone, Mail } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { submitContact } from "@/lib/api-client";
import { toast } from "sonner";

export const Route = createFileRoute("/contact-us")({
  head: () => ({
    meta: [
      { title: "Contact CutHaven — We're Here to Help" },
      {
        name: "description",
        content:
          "Contact CutHaven. Reach our team by email, phone, or the contact form. FAQs answered.",
      },
      { property: "og:title", content: "Contact CutHaven" },
      { property: "og:description", content: "Send us a message or find answers in our FAQs." },
    ],
  }),
  component: ContactPage,
});

const faqs = [
  {
    q: "How long does shipping take?",
    a: "Standard shipping takes 5–8 business days across the US. Express options available at checkout.",
  },
  {
    q: "What is your return policy?",
    a: "We offer a 40-day hassle-free return policy on all items. Items must be unused and in original packaging.",
  },
  { q: "Do you offer free shipping?", a: "Yes! We offer free shipping on all orders over $350." },
  {
    q: "How do I track my order?",
    a: "Use our Track Your Order page with your order number and email address.",
  },
  {
    q: "Can I change or cancel my order?",
    a: "Orders can be modified or cancelled within 24 hours of placement. Contact support immediately.",
  },
  {
    q: "Are your products covered by warranty?",
    a: "All products include a 12-month manufacturer warranty against defects.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept Visa, Mastercard, PayPal, American Express, and Discover.",
  },
  { q: "Do you ship internationally?", a: "Currently we ship within the United States only." },
  {
    q: "How do I contact customer support?",
    a: "Email support@cuthaven.com or call +1 (406) 229-9045.",
  },
  {
    q: "Are your products authentic?",
    a: "All products are 100% authentic and sourced directly from manufacturers.",
  },
];

function ContactPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await submitContact({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        subject: form.subject || undefined,
        message: form.message,
      });
      setSent(true);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const upd = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div>
      <PageHero title="Get in Touch" subtitle="We're here to answer all your questions." />

      <section className="mx-auto max-w-7xl px-4 py-12 grid md:grid-cols-3 gap-5">
        {[
          {
            icon: MapPin,
            title: "Our Location",
            lines: ["1633 S Industrial Way", "Palmer, AK 99645"],
          },
          { icon: Phone, title: "Call Us", lines: ["+1 (406) 229-9045"] },
          {
            icon: Mail,
            title: "Email Us",
            lines: ["support@cuthaven.com", "We reply within 24 hours"],
          },
        ].map((c) => (
          <div key={c.title} className="card-surface p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 grid place-items-center mx-auto mb-3">
              <c.icon className="h-5 w-5 text-primary" />
            </div>
            <p className="font-semibold mb-1">{c.title}</p>
            {c.lines.map((l) => (
              <p key={l} className="text-sm text-text-secondary">
                {l}
              </p>
            ))}
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 grid md:grid-cols-2 gap-8">
        <div className="card-surface p-8">
          <h2 className="font-display text-2xl font-bold mb-2">Fill out the form</h2>
          <p className="text-sm text-text-secondary mb-5">
            We're here to answer any questions you may have.
          </p>
          {sent ? (
            <div className="rounded-lg bg-success/10 text-success p-4 text-sm">
              Thanks! We'll be in touch within 24 hours.
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <input
                required
                placeholder="Your Name"
                value={form.name}
                onChange={(e) => upd("name", e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary text-sm"
              />
              <input
                required
                type="email"
                placeholder="Your Email"
                value={form.email}
                onChange={(e) => upd("email", e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary text-sm"
              />
              <input
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={(e) => upd("phone", e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary text-sm"
              />
              <input
                placeholder="Subject"
                value={form.subject}
                onChange={(e) => upd("subject", e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary text-sm"
              />
              <textarea
                required
                rows={5}
                placeholder="Your Message"
                value={form.message}
                onChange={(e) => upd("message", e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary text-sm"
              />
              <button disabled={loading} className="btn-primary disabled:opacity-60">
                {loading ? "Sending…" : "Send Message →"}
              </button>
            </form>
          )}
        </div>
        <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
          <iframe
            src="https://maps.google.com/maps?q=1633+S+Industrial+Way+Palmer+AK+99645&output=embed"
            width="100%"
            height="400"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="CutHaven location — 1633 S Industrial Way, Palmer, AK 99645"
          />
          <div className="p-6">
            <p className="font-semibold mb-2">Business Hours</p>
            <p className="text-sm text-text-secondary">
              Mon–Fri: 9am–6pm EST
              <br />
              Sat: 10am–4pm EST
              <br />
              Sun: Closed
            </p>
          </div>
        </div>
      </section>

      <section id="faqs" className="mx-auto max-w-3xl px-4 pb-16 scroll-mt-24">
        <div className="text-center mb-8">
          <p className="text-accent text-sm uppercase tracking-widest font-semibold">Answers</p>
          <h2 className="font-display text-3xl font-bold mt-2">Frequently Asked Questions</h2>
        </div>
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`i-${i}`} className="card-surface px-4">
              <AccordionTrigger className="text-left font-semibold">{f.q}</AccordionTrigger>
              <AccordionContent className="text-text-secondary text-sm">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}
