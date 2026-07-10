import { createFileRoute, Link } from "@tanstack/react-router";
import { Leaf, Eye } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/account/login")({
  head: () => ({ meta: [{ title: "Log In — CutHaven" }, { name: "robots", content: "noindex" }] }),
  component: LoginPage,
});

function LoginPage() {
  const [showPw, setShowPw] = useState(false);
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card-surface p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-2 mb-3"><Leaf className="h-6 w-6 text-primary" /><span className="font-display text-2xl font-bold text-primary">CutHaven</span></div>
          <h1 className="font-display text-2xl font-bold">Welcome Back</h1>
        </div>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium mb-1.5">Email</label>
            <input id="login-email" type="email" autoComplete="email" required className="w-full px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary text-sm" />
          </div>
          <div>
            <label htmlFor="login-pw" className="block text-sm font-medium mb-1.5">Password</label>
            <div className="relative">
              <input id="login-pw" type={showPw ? "text" : "password"} autoComplete="current-password" required className="w-full px-3 py-2.5 pr-10 rounded-lg border border-border focus:outline-none focus:border-primary text-sm" />
              <button type="button" onClick={() => setShowPw(!showPw)} aria-label="Toggle password" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"><Eye className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-primary" /> Remember me</label>
            <Link to="/account/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
          </div>
          <button className="btn-primary w-full">Log In</button>
        </form>
        <div className="my-6 flex items-center gap-3 text-xs text-text-secondary"><span className="flex-1 border-t border-border" />OR<span className="flex-1 border-t border-border" /></div>
        <p className="text-center text-sm">Don't have an account? <Link to="/account/register" className="text-primary font-semibold hover:underline">Create one →</Link></p>
      </div>
    </div>
  );
}
