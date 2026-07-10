import { Check } from "lucide-react";

export function PasswordStrength({ password }: { password: string }) {
  const rules = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "One uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "One number", ok: /\d/.test(password) },
  ];
  if (!password) return null;
  return (
    <ul className="mt-2 space-y-1">
      {rules.map((r) => (
        <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.ok ? "text-success" : "text-text-secondary"}`}>
          <Check className={`h-3 w-3 ${r.ok ? "opacity-100" : "opacity-40"}`} /> {r.label}
        </li>
      ))}
    </ul>
  );
}
