"use client";

// Invite-only login. No public signup, no email verification — the owner
// provisions accounts manually in the Supabase dashboard.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

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
    <main className="kb-narrow" style={{ paddingTop: "var(--space-20)" }}>
      <Logo markSize={32} />
      <h1 style={{ marginTop: "var(--space-6)" }}>We looked into it.</h1>
      <p style={{ color: "var(--text-muted)" }}>
        KnowBro is invite-only. Sign in to your dossiers, models, and analysis.
      </p>
      <form onSubmit={submit} style={{ marginTop: "var(--space-6)" }}>
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
          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
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
