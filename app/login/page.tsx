"use client";

// Invite-only login. No public signup, no email verification — the owner
// provisions accounts manually in the Supabase dashboard.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <main>
      <h1>Company Intelligence — sign in</h1>
      <p>
        <small>Invite-only. Accounts are provisioned by the owner.</small>
      </p>
      <form onSubmit={submit}>
        <p>
          <label>
            Email
            <br />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} size={40} required />
          </label>
        </p>
        <p>
          <label>
            Password
            <br />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} size={40} required />
          </label>
        </p>
        <p>
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </p>
      </form>
      {error && (
        <p>
          <strong>Error:</strong> {error}
        </p>
      )}
    </main>
  );
}
