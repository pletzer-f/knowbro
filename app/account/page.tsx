"use client";

// Account: change your password (self-service — closes the forgot-password
// gap without adding email flows, which the spec deliberately avoids).

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError("Use at least 10 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setState("saving");
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setState("idle");
      return;
    }
    setState("saved");
    setPassword("");
    setConfirm("");
  };

  return (
    <main>
      <h1>Account</h1>
      <h3>Change password</h3>
      <form onSubmit={submit}>
        <p>
          <label>
            New password (min. 10 characters)
            <br />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} size={40} required />
          </label>
        </p>
        <p>
          <label>
            Repeat new password
            <br />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} size={40} required />
          </label>
        </p>
        <p>
          <button type="submit" disabled={state === "saving"}>
            {state === "saving" ? "Saving..." : "Change password"}
          </button>{" "}
          {state === "saved" && <strong>Password changed — it applies to all your devices from now on.</strong>}
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
