"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DossierRow {
  id: string;
  company_name: string;
  config_fingerprint: string;
  created_at: string;
}

export default function DossiersPage() {
  const [rows, setRows] = useState<DossierRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/dossiers");
    const json = await res.json();
    if (!res.ok) setError(json.error);
    else setRows(json.dossiers);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    if (!confirm("Delete this saved dossier?")) return;
    await fetch(`/api/dossiers/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <main>
      <h1>My dossiers</h1>
      {error && <p><strong>Error:</strong> {error}</p>}
      {rows === null ? (
        <p>Loading...</p>
      ) : rows.length === 0 ? (
        <p>
          No saved dossiers yet. <Link href="/">Analyse a company</Link> and hit save.
        </p>
      ) : (
        <table border={1} cellPadding={6}>
          <thead>
            <tr>
              <th>Company</th>
              <th>Saved</th>
              <th>Engine config</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/dossiers/${r.id}`}>{r.company_name}</Link>
                </td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>
                  <small>{r.config_fingerprint}</small>
                </td>
                <td>
                  <button type="button" onClick={() => remove(r.id)}>
                    delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
