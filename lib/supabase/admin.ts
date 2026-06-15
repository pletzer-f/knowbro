// Service-role Supabase client — bypasses RLS. ONLY for trusted server-side
// background jobs (the monitoring cron), NEVER exposed to the browser and
// NEVER used in a route that serves user input without explicit user_id
// scoping. Requires SUPABASE_SERVICE_ROLE_KEY (server-only env var).

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set — the monitoring cron cannot run.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function adminConfigured(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}
