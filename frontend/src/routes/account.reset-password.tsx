import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Leaf, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { toast } from "sonner";

// Supabase appends #access_token=...&refresh_token=... to the reset URL.
// TanStack Router doesn't expose hash params via search, so we read them
// from window.location.hash manually.
function parseHashTokens(): { accessToken: string; refreshToken: string } | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1); // strip leading #
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

const searchSchema = z.object({}).optional();

export const Route = createFileRoute("/account/reset-password")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Create New Password — CutHaven" },
      { name: "description", content: "Set a new password for your CutHaven account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const [tokens, setTokens] = useState<{ accessToken: string; refreshToken: string } | null>(null);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = parseHashTokens();
    if (t) {
      setTokens(t);
      // Clean up hash from URL bar without triggering a navigation
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const e2: Record<string, string> = {};
    if (pw.length < 8) e2.pw = "Must be at least 8 characters";
    if (pw !== confirm) e2.confirm = "Passwords do not match";
    setErr(e2);
    if (Object.keys(e2).length > 0) return;

    if (!tokens) {
      setErr({ form: "Reset link is invalid or has expired. Please request a new one." });
      return;
    }

    setLoading(true);
    try {
      await resetPassword(tokens.accessToken, tokens.refreshToken, pw);
      setDone(true);
      toast.success("Password updated! Please sign in.");
    } catch (error) {
      setErr({ form: error instanceof Error ? error.message : "Failed to reset password" });
    } finally {
      setLoading(false);
    }
  };

  // No tokens in URL — the user landed here without a valid reset link
  if (!tokens && !done) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-8 text-center">
          <div className="flex flex-col items-center mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Leaf className="h-6 w-6 text-primary" />
              <span className="font-display text-2xl font-bold text-primary">CutHaven</span>
            </div>
          </div>
          <p className="text-sm text-text-secondary mb-4">
            This reset link is invalid or has expired.
          </p>
          <Link to="/account/forgot-password" className="btn-primary inline-flex">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="bg-surface rounded-2xl border border-border shadow-sm p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="font-display text-2xl font-bold text-primary">CutHaven</span>
          </div>
          <h1 className="font-display text-2xl font-bold">Create New Password</h1>
        </div>

        {done ? (
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
            <p className="font-semibold">Password updated!</p>
            <p className="text-sm text-text-secondary mt-1">
              You can now sign in with your new password.
            </p>
            <button
              onClick={() => navigate({ to: "/account/login" })}
              className="btn-primary mt-6 inline-flex"
            >
              Sign In
            </button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            {err.form && (
              <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {err.form}
              </div>
            )}

            <div>
              <label htmlFor="rp-new" className="block text-sm font-medium mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  id="rp-new"
                  type={show1 ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={pw}
                  onChange={(e) => {
                    setPw(e.target.value);
                    setErr({ ...err, pw: "" });
                  }}
                  className={`w-full px-3 py-2.5 pr-10 rounded-lg border text-sm focus:outline-none ${err.pw ? "border-destructive" : "border-border focus:border-primary"}`}
                />
                <button
                  type="button"
                  onClick={() => setShow1(!show1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
                  aria-label="Toggle password"
                >
                  {show1 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {err.pw && <p className="text-xs text-destructive mt-1">{err.pw}</p>}
              <PasswordStrength password={pw} />
            </div>

            <div>
              <label htmlFor="rp-conf" className="block text-sm font-medium mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="rp-conf"
                  type={show2 ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setErr({ ...err, confirm: "" });
                  }}
                  className={`w-full px-3 py-2.5 pr-10 rounded-lg border text-sm focus:outline-none ${err.confirm ? "border-destructive" : "border-border focus:border-primary"}`}
                />
                <button
                  type="button"
                  onClick={() => setShow2(!show2)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
                  aria-label="Toggle password"
                >
                  {show2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {err.confirm && <p className="text-xs text-destructive mt-1">{err.confirm}</p>}
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Updating…" : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
