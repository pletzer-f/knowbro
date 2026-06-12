"use client";

// A saved dossier: same interactive surface as a fresh analysis, but overrides
// persist to the database row and the private note is editable alongside.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Critique, Dossier, LensConfig, AnalysisInput, TraceStep } from "@/engine/src/types";
import { resolveView } from "@/engine/src/lens";
import { withEdit, type DossierEdits } from "@/lib/edits";
import DossierView, { CritiquePanel, type Overrides } from "@/components/DossierView";
import ChatPanel from "@/components/ChatPanel";

import investorLens from "@/engine/config/lenses/investor.json";
import entrepreneurLens from "@/engine/config/lenses/entrepreneur.json";
import curiousLens from "@/engine/config/lenses/curious.json";

const LENSES = [investorLens, entrepreneurLens, curiousLens] as LensConfig[];

interface SavedDossier {
  id: string;
  company_id: string;
  company_name: string;
  input: AnalysisInput;
  draft: Dossier;
  critique: Critique;
  dossier: Dossier;
  steps: TraceStep[];
  config_fingerprint: string;
  overrides: Overrides;
  edits: DossierEdits;
  created_at: string;
}

export default function SavedDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [row, setRow] = useState<SavedDossier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lensId, setLensId] = useState("investor");
  const [viewId, setViewId] = useState<string | undefined>(undefined);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [edits, setEdits] = useState<DossierEdits>({});
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/dossiers/${id}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setRow(json);
      setOverrides(json.overrides ?? {});
      setEdits(json.edits ?? {});
      const noteRes = await fetch(`/api/notes?company=${encodeURIComponent(json.company_name)}`);
      if (noteRes.ok) setNote((await noteRes.json()).content);
    })();
  }, [id]);

  const handleOverride = async (estimateId: string, value: string | null) => {
    const next = { ...overrides };
    if (value === null) delete next[estimateId];
    else next[estimateId] = value;
    setOverrides(next);
    await fetch(`/api/dossiers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overrides: next }),
    });
  };

  const handleEdit = async (path: string, value: string | null) => {
    const next = withEdit(edits, path, value);
    setEdits(next);
    await fetch(`/api/dossiers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edits: next }),
    });
  };

  const saveNote = async () => {
    if (!row) return;
    setNoteState("saving");
    await fetch("/api/notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_name: row.company_name, content: note }),
    });
    setNoteState("saved");
    setTimeout(() => setNoteState("idle"), 2000);
  };

  const downloadTrace = () => {
    if (!row) return;
    const blob = new Blob([JSON.stringify(row, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dossier-${row.company_name}-${row.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (error) return <main><p><strong>Error:</strong> {error}</p></main>;
  if (!row) return <main><p>Loading...</p></main>;

  const lens = LENSES.find((l) => l.id === lensId) ?? LENSES[0];
  const view = resolveView(lens, viewId);

  return (
    <main>
      <p>
        <Link href={`/companies/${row.company_id}`}>← {row.company_name} (company page &amp; financial model)</Link>
      </p>
      <p>
        <small>Saved {new Date(row.created_at).toLocaleString()}</small>
      </p>
      <p>
        <label>
          Lens{" "}
          <select
            value={lensId}
            onChange={(e) => {
              setLensId(e.target.value);
              setViewId(undefined);
            }}
          >
            {LENSES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>{" "}
        {lens.views.length > 1 &&
          lens.views.map((v) => (
            <label key={v.id} title={v.tagline}>
              <input type="radio" name="view" checked={view.id === v.id} onChange={() => setViewId(v.id)} />
              {v.label}{" "}
            </label>
          ))}
      </p>
      <DossierView
        dossier={row.dossier}
        lens={lens}
        view={view}
        overrides={overrides}
        onOverride={handleOverride}
        edits={edits}
        onEdit={handleEdit}
      />
      <hr />
      <ChatPanel dossierId={row.id} companyName={row.company_name} />
      <hr />
      <h3>My private notes on {row.company_name}</h3>
      <p>
        <small>Only you can see these. They are reused as engine input the next time you analyse this company.</small>
      </p>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} cols={100} />
      <p>
        <button type="button" onClick={saveNote} disabled={noteState === "saving"}>
          {noteState === "saving" ? "Saving..." : noteState === "saved" ? "Saved!" : "Save note"}
        </button>
      </p>
      <hr />
      <details>
        <summary>Engine room — how this dossier was made</summary>
        <p>
          <button type="button" onClick={downloadTrace}>
            Download full reasoning trace (JSON)
          </button>{" "}
          <small>engine config {row.config_fingerprint}</small>
        </p>
        <CritiquePanel critique={row.critique} />
      </details>
    </main>
  );
}
