import { createFileRoute, Link } from "@tanstack/react-router";
import { Leaf, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/account/forgot-password")({
  head: () => ({ meta: [
    { title: "Reset Password — CutHaven" },
    { name: "description", content: "Request a password reset link for your CutHaven account." },
    { property: "og:title", content: "Reset Password — CutHaven" },
    { property: "og:description", content: "Request a password reset link for your CutHaven account." },
  ] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Please enter a valid email address"); return; }
    setError("");
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch {
      // Always show success — never reveal whether email exists
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="bg-surface rounded-2xl border border-border shadow-sm p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-2 mb-3"><Leaf className="h-6 w-6 text-primary" /><span className="font-display text-2xl font-bold text-primary">CutHaven</span></div>
          <h1 className="font-display text-2xl font-bold">Reset Your Password</h1>
        </div>

        {sent ? (
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
            <p className="text-sm">If an account exists for that email, a reset link has been sent.</p>
            <Link to="/account/login" className="btn-primary mt-6 inline-flex"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Sign In</Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-text-secondary text-center mb-6">Enter your email and we'll send you a reset link.</p>
            <form className="space-y-4" onSubmit={submit}>
              <div>
                <label htmlFor="fp-email" className="block text-sm font-medium mb-1.5">Email address</label>
                <input id="fp-email" type="email" autoComplete="email" required value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none ${error ? "border-destructive" : "border-border focus:border-primary"}`} />
                {error && <p className="text-xs text-destructive mt-1">{error}</p>}
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
            <p className="text-center text-sm mt-6"><Link to="/account/login" className="text-primary hover:underline">← Back to Sign In</Link></p>
          </>
        )}
      </div>
    </div>
  );
}
