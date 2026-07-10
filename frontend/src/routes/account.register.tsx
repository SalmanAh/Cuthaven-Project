import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/account/register")({
  head: () => ({ meta: [{ title: "Create Account — CutHaven" }, { name: "robots", content: "noindex" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card-surface p-8">
        <h1 className="font-display text-2xl font-bold text-center mb-6">Create Account</h1>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">First Name</label>
              <input required className="w-full px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Last Name</label>
              <input required className="w-full px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input required type="email" className="w-full px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input required type="password" className="w-full px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Confirm Password</label>
            <input required type="password" className="w-full px-3 py-2.5 rounded-lg border border-border focus:outline-none focus:border-primary text-sm" />
          </div>
          <label className="flex items-start gap-2 text-sm"><input required type="checkbox" className="mt-1 accent-primary" />
            <span>I agree to the <Link to="/terms-of-service" className="text-primary hover:underline">Terms of Service</Link> and <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>.</span>
          </label>
          <button className="btn-primary w-full">Create Account</button>
        </form>
        <p className="text-center text-sm mt-5">Already have an account? <Link to="/account/login" className="text-primary font-semibold hover:underline">Sign In →</Link></p>
      </div>
    </div>
  );
}
