import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Leaf, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/account/login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Log In — CutHaven" }, { name: "robots", content: "noindex" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/account/login" });

  // Already logged in — redirect immediately
  useEffect(() => {
    if (user) {
      const dest =
        user.role === "admin"
          ? "/admin/dashboard"
          : user.role === "store_manager"
            ? "/store-manager/dashboard"
            : "/account/dashboard";
      navigate({ to: search.redirect ?? dest, replace: true });
    }
  }, [user, navigate, search.redirect]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);

      // Redirect to where they came from, or role-appropriate dashboard
      const destination = search.redirect ?? "/account/dashboard";
      navigate({ to: destination });
      toast.success("Welcome back!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card-surface p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="font-display text-2xl font-bold text-primary">CutHaven</span>
          </div>
          <h1 className="font-display text-2xl font-bold">Welcome Back</h1>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium mb-1.5">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary text-sm"
            />
          </div>

          <div>
            <label htmlFor="login-pw" className="block text-sm font-medium mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="login-pw"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 pr-10 rounded-lg border border-border focus:outline-none focus:border-primary text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                aria-label="Toggle password"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-primary" /> Remember me
            </label>
            <Link to="/account/forgot-password" className="text-primary hover:underline">
              Forgot password?
            </Link>
          </div>

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in…" : "Log In"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-text-secondary">
          <span className="flex-1 border-t border-border" />
          OR
          <span className="flex-1 border-t border-border" />
        </div>

        <p className="text-center text-sm">
          Don't have an account?{" "}
          <Link to="/account/register" className="text-primary font-semibold hover:underline">
            Create one →
          </Link>
        </p>
      </div>
    </div>
  );
}
