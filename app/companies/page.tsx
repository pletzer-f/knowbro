"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CompanyRow {
  id: string;
  name: string;
  created_at: string;
  dossier_count: number;
  latest_dossier_at: string | null;
  has_model: boolean;
}

export default function CompaniesPage() {
  const [rows, setRows] = useState<CompanyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/companies");
    const json = await res.json();
    if (!res.ok) setError(json.error);
    else setRows(json.companies);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete ${name} including all its dossiers, model and chats? This cannot be undone.`)) return;
    await fetch(`/api/companies/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <main>
      <h1>My companies</h1>
      {error && (
        <p>
          <strong>Error:</strong> {error}
        </p>
      )}
      {rows === null ? (
        <p>Loading...</p>
      ) : rows.length === 0 ? (
        <p>
          No companies yet. <Link href="/">Analyse one</Link> and save the dossier — the company appears here.
        </p>
      ) : (
        <table border={1} cellPadding={6}>
          <thead>
            <tr>
              <th>Company</th>
              <th>Dossiers</th>
              <th>Latest dossier</th>
              <th>Financial model</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/companies/${r.id}`}>
                    <strong>{r.name}</strong>
                  </Link>
                </td>
                <td>{r.dossier_count}</td>
                <td>{r.latest_dossier_at ? new Date(r.latest_dossier_at).toLocaleString() : "—"}</td>
                <td>{r.has_model ? "set up" : "—"}</td>
                <td>
                  <button type="button" onClick={() => remove(r.id, r.name)}>
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
