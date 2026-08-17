import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { PasswordStrength } from "@/components/ui/PasswordStrength";

export const Route = createFileRoute("/account/register")({
  head: () => ({
    meta: [{ title: "Create Account — CutHaven" }, { name: "robots", content: "noindex" }],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { register, user } = useAuth();
  const navigate = useNavigate();

  // Already logged in — don't show register page
  useEffect(() => {
    if (user) navigate({ to: "/account/dashboard", replace: true });
  }, [user, navigate]);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirm: "",
    agreed: false,
  });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const upd = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim()) e.lastName = "Required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Valid email required";
    if (form.password.length < 8) e.password = "Minimum 8 characters";
    if (form.password !== form.confirm) e.confirm = "Passwords do not match";
    if (!form.agreed) e.agreed = "You must agree to the terms";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const e2 = validate();
    setErrors(e2);
    if (Object.keys(e2).length > 0) return;

    setLoading(true);
    try {
      await register(form.email, form.password, form.firstName, form.lastName);
      toast.success("Account created! Welcome to CutHaven.");
      navigate({ to: "/account/dashboard" });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Registration failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card-surface p-8">
        <h1 className="font-display text-2xl font-bold text-center mb-6">Create Account</h1>

        {errors.form && (
          <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errors.form}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">First Name</label>
              <input
                required
                value={form.firstName}
                onChange={(e) => upd("firstName", e.target.value)}
                className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none ${errors.firstName ? "border-destructive" : "border-border focus:border-primary"}`}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive mt-1">{errors.firstName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Last Name</label>
              <input
                required
                value={form.lastName}
                onChange={(e) => upd("lastName", e.target.value)}
                className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none ${errors.lastName ? "border-destructive" : "border-border focus:border-primary"}`}
              />
              {errors.lastName && (
                <p className="text-xs text-destructive mt-1">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              required
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => upd("email", e.target.value)}
              className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none ${errors.email ? "border-destructive" : "border-border focus:border-primary"}`}
            />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <div className="relative">
              <input
                required
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => upd("password", e.target.value)}
                className={`w-full px-3 py-2.5 pr-10 rounded-lg border text-sm focus:outline-none ${errors.password ? "border-destructive" : "border-border focus:border-primary"}`}
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
            {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
            <PasswordStrength password={form.password} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Confirm Password</label>
            <div className="relative">
              <input
                required
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={form.confirm}
                onChange={(e) => upd("confirm", e.target.value)}
                className={`w-full px-3 py-2.5 pr-10 rounded-lg border text-sm focus:outline-none ${errors.confirm ? "border-destructive" : "border-border focus:border-primary"}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label="Toggle password"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirm && <p className="text-xs text-destructive mt-1">{errors.confirm}</p>}
          </div>

          <div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-primary"
                checked={form.agreed}
                onChange={(e) => upd("agreed", e.target.checked)}
              />
              <span>
                I agree to the{" "}
                <Link to="/terms-of-service" className="text-primary hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy-policy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {errors.agreed && <p className="text-xs text-destructive mt-1">{errors.agreed}</p>}
          </div>

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm mt-5">
          Already have an account?{" "}
          <Link to="/account/login" className="text-primary font-semibold hover:underline">
            Sign In →
          </Link>
        </p>
      </div>
    </div>
  );
}
