import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, Cookie } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

const KEY = "ch-cookie-consent";
interface Prefs { necessary: true; analytics: boolean; marketing: boolean; timestamp: number; }

export function CookieConsent({ openSignal = 0 }: { openSignal?: number }) {
  const [visible, setVisible] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (!s) setVisible(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (openSignal > 0) {
      try {
        const s = localStorage.getItem(KEY);
        if (s) { const p: Prefs = JSON.parse(s); setAnalytics(p.analytics); setMarketing(p.marketing); }
      } catch {}
      setVisible(true); setCustomize(true);
    }
  }, [openSignal]);

  const save = (a: boolean, m: boolean) => {
    const prefs: Prefs = { necessary: true, analytics: a, marketing: m, timestamp: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
    setVisible(false); setCustomize(false);
  };

  if (!visible) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 md:bottom-4 md:left-4 md:right-auto md:max-w-[420px] z-50 pointer-events-none">
        <div className="pointer-events-auto bg-surface border border-border shadow-lg md:rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Cookie className="h-6 w-6 text-accent shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-base">We value your privacy</p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies. See our{" "}
                <Link to="/privacy-policy" className="text-primary underline">Privacy Policy</Link>.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <button onClick={() => save(true, true)} className="btn-primary text-xs px-3 py-1.5">Accept All</button>
                <button onClick={() => save(false, false)} className="btn-outline-primary text-xs px-3 py-1.5">Necessary Only</button>
                <button onClick={() => setCustomize(true)} className="text-xs text-text-secondary hover:text-primary underline">Customize</button>
              </div>
            </div>
            <button onClick={() => save(false, false)} aria-label="Close" className="text-text-secondary hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      <Dialog open={customize} onOpenChange={setCustomize}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cookie Preferences</DialogTitle>
            <DialogDescription>Choose which cookies you allow. You can change this any time.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-semibold">Strictly Necessary</p><p className="text-xs text-text-secondary">Required for the site to function.</p></div>
              <Switch checked disabled />
            </label>
            <label className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-semibold">Analytics</p><p className="text-xs text-text-secondary">Help us understand how visitors interact with the site.</p></div>
              <Switch checked={analytics} onCheckedChange={setAnalytics} />
            </label>
            <label className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-semibold">Marketing</p><p className="text-xs text-text-secondary">Personalize ads and measure their performance.</p></div>
              <Switch checked={marketing} onCheckedChange={setMarketing} />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCustomize(false)} className="btn-outline-primary text-sm px-4 py-2">Cancel</button>
            <button onClick={() => save(analytics, marketing)} className="btn-primary text-sm px-4 py-2">Save Preferences</button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
