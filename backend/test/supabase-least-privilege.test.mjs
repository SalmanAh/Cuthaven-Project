import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("user auth uses the anon key while admin access keeps the service-role key", () => {
  const config = read("../src/config/supabase.ts");
  const env = read("../src/config/env.ts");
  const example = read("../.env.example");
  const auth = read("../src/controllers/auth.controller.ts");

  assert.match(
    config,
    /supabaseAuth\s*=\s*createClient\(env\.SUPABASE_URL, env\.SUPABASE_ANON_KEY,/,
  );
  assert.match(
    config,
    /supabaseAdmin\s*=\s*createClient\(env\.SUPABASE_URL, env\.SUPABASE_SERVICE_ROLE_KEY,/,
  );
  assert.match(env, /SUPABASE_ANON_KEY:\s*z\.string\(\)\.min\(1\)/);
  assert.match(example, /^SUPABASE_ANON_KEY=/m);
  assert.match(auth, /supabaseAuth\.auth\.resetPasswordForEmail/);
  assert.doesNotMatch(auth, /supabaseAdmin\.auth\.resetPasswordForEmail/);
});

test("feed operational status is restricted to administrators", () => {
  const routes = read("../src/routes/feed.routes.ts");

  assert.match(
    routes,
    /feedRouter\.get\("\/status",\s*requireAuth,\s*requireRole\("admin"\),\s*getFeedStatus\)/,
  );
});
