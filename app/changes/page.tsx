"use client";

// The changes feed — material changes across all watched companies, newest
// first. The heartbeat of the living-dossier feature.

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";

interface Change {
  id: string;
  company_id: string;
  company_name: string;
  ran_at: string;
  summary: string;
  dossier_id: string | null;
  delta: {
    confidence_shifts?: { label: string; from: string; to: string; direction: string }[];
    deal_killers_added?: string[];
    health_changed?: { from: string; to: string } | null;
  };
}

export default function ChangesPage() {
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/changes")
      .then((r) => r.json())
      .then((j) => (j.error ? setError(j.error) : setChanges(j.changes)))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="kb-narrow">
      <p className="kb-eyebrow">Monitoring</p>
      <h1>Changes</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Material changes the engine found on the companies you watch. Nothing here means nothing moved.
      </p>
      {error && <p><strong>Error:</strong> {error}</p>}
      {changes === null ? (
        <p className="kb-meter">Loading…</p>
      ) : changes.length === 0 ? (
        <p className="kb-meter">
          No changes yet. Watch a company from its page, and material changes will surface here.
        </p>
      ) : (
        <div className="kb-stagger">
          {changes.map((c, i) => (
            <details key={c.id} open={i < 3} style={{ "--kb-i": i } as CSSProperties}>
              <summary>
                <strong>{c.company_name}</strong>{" "}
                <span className="kb-meter">· {new Date(c.ran_at).toLocaleDateString()}</span>
              </summary>
              <p>{c.summary}</p>
              {(c.delta?.confidence_shifts ?? []).length > 0 && (
                <ul>
                  {c.delta.confidence_shifts!.map((s, j) => (
                    <li key={j}>
                      <strong>{s.label}</strong>: {s.from} → {s.to}{" "}
                      <span style={{ color: s.direction === "down" ? "var(--conf-low-fg)" : "var(--conf-high-fg)" }}>
                        ({s.direction})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {c.dossier_id && (
                <p>
                  <Link href={`/dossiers/${c.dossier_id}`}>open updated dossier</Link> ·{" "}
                  <Link href={`/companies/${c.company_id}`}>company</Link>
                </p>
              )}
            </details>
          ))}
        </div>
      )}
    </main>
  );
}
