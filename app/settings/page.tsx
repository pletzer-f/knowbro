"use client";

import { useEffect, useState } from "react";
import type { DataSource } from "@/lib/sources";

type SourceWithState = DataSource & { enabled: boolean };

export default function SettingsPage() {
  const [sources, setSources] = useState<SourceWithState[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/source-preferences");
      const json = await res.json();
      if (!res.ok) setError(json.error);
      else setSources(json.sources);
    })();
  }, []);

  const toggle = async (id: string, enabled: boolean) => {
    setSources((prev) => prev?.map((s) => (s.id === id ? { ...s, enabled } : s)) ?? null);
    await fetch("/api/source-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_id: id, enabled }),
    });
  };

  return (
    <main>
      <h1>Source preferences</h1>
      <p>
        <small>
          Live data pulls arrive in Phase 4. Your choices here are stored now and will be honoured then: a
          source you switch off is never pulled for your analyses.
        </small>
      </p>
      {error && <p><strong>Error:</strong> {error}</p>}
      {sources === null ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {sources.map((s) => (
            <li key={s.id}>
              <label>
                <input type="checkbox" checked={s.enabled} onChange={(e) => toggle(s.id, e.target.checked)} />{" "}
                <strong>{s.label}</strong> — <small>{s.description}</small>
              </label>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
