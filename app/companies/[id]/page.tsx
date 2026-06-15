"use client";

// The company hub: one living financial model + the time-stamped dossiers +
// the private note. Dossiers open in their own page for reading and editing.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Dossier } from "@/engine/src/types";
import type { ModelParams } from "@/lib/model";
import ModelPanel from "@/components/ModelPanel";
import MonitorPanel from "@/components/MonitorPanel";

interface CompanyPayload {
  company: { id: string; name: string; created_at: string };
  dossiers: { id: string; config_fingerprint: string; created_at: string }[];
  model: { params: ModelParams | Record<string, never>; custom_metrics: { prompt: string; response: string; created_at: string }[] } | null;
  latest_dossier: Dossier | null;
}

export default function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<CompanyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/companies/${id}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setData(json);
      const noteRes = await fetch(`/api/notes?company=${encodeURIComponent(json.company.name)}`);
      if (noteRes.ok) setNote((await noteRes.json()).content);
    })();
  }, [id]);

  const saveNote = async () => {
    if (!data) return;
    setNoteState("saving");
    await fetch("/api/notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_name: data.company.name, content: note }),
    });
    setNoteState("saved");
    setTimeout(() => setNoteState("idle"), 2000);
  };

  if (error)
    return (
      <main>
        <p>
          <strong>Error:</strong> {error}
        </p>
      </main>
    );
  if (!data)
    return (
      <main>
        <p>Loading...</p>
      </main>
    );

  const modelParams =
    data.model && data.model.params && Object.keys(data.model.params).length > 0
      ? (data.model.params as ModelParams)
      : null;

  return (
    <main>
      <p>
        <Link href="/companies">← My companies</Link>
      </p>
      <h1>{data.company.name}</h1>

      <ModelPanel
        companyId={data.company.id}
        initialParams={modelParams}
        initialMetrics={data.model?.custom_metrics ?? []}
        latestDossier={data.latest_dossier}
      />

      <hr />
      <MonitorPanel companyId={data.company.id} hasDossier={data.dossiers.length > 0} />

      <hr />
      <h3>Dossiers</h3>
      {data.dossiers.length === 0 ? (
        <p>
          No dossiers yet. <Link href={`/analyse?company=${encodeURIComponent(data.company.name)}`}>Run an analysis</Link>.
        </p>
      ) : (
        <>
          <table border={1} cellPadding={6}>
            <thead>
              <tr>
                <th>Created</th>
                <th>Engine config</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.dossiers.map((d) => (
                <tr key={d.id}>
                  <td>{new Date(d.created_at).toLocaleString()}</td>
                  <td>
                    <small>{d.config_fingerprint}</small>
                  </td>
                  <td>
                    <Link href={`/dossiers/${d.id}`}>open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <Link href={`/analyse?company=${encodeURIComponent(data.company.name)}`}>Run a new analysis</Link>{" "}
            <small>(adds a new time-stamped dossier under this company)</small>
          </p>
        </>
      )}

      <hr />
      <h3>My private notes</h3>
      <p>
        <small>Reused as engine input on future analyses of this company.</small>
      </p>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} cols={100} />
      <p>
        <button type="button" onClick={saveNote} disabled={noteState === "saving"}>
          {noteState === "saving" ? "Saving..." : noteState === "saved" ? "Saved!" : "Save note"}
        </button>
      </p>
    </main>
  );
}
