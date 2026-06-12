"use client";

// Phase-1 surface: paste data, run the engine, inspect the dossier.
// Deliberately unstyled — see docs/SPEC.md.

import { useEffect, useState } from "react";
import type { AnalysisResult, LensConfig } from "@/engine/src/types";
import DossierView, { CritiquePanel, type Overrides } from "@/components/DossierView";

import investorLens from "@/engine/config/lenses/investor.json";
import entrepreneurLens from "@/engine/config/lenses/entrepreneur.json";
import curiousLens from "@/engine/config/lenses/curious.json";

const LENSES = [investorLens, entrepreneurLens, curiousLens] as LensConfig[];

export default function Home() {
  const [companyName, setCompanyName] = useState("");
  const [rawData, setRawData] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [lensId, setLensId] = useState("investor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({});

  const overridesKey = result ? `wba-overrides:${result.input.companyName}` : null;

  // Phase 1: overrides persist locally per company; Phase 2 moves them to the DB.
  useEffect(() => {
    if (!overridesKey) return;
    const stored = localStorage.getItem(overridesKey);
    setOverrides(stored ? JSON.parse(stored) : {});
  }, [overridesKey]);

  const handleOverride = (id: string, value: string | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (value === null) delete next[id];
      else next[id] = value;
      if (overridesKey) localStorage.setItem(overridesKey, JSON.stringify(next));
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, rawData, userNotes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setResult(json as AnalysisResult);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const downloadTrace = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${result.traceId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const lens = LENSES.find((l) => l.id === lensId) ?? LENSES[0];

  return (
    <main>
      <h1>Company Intelligence — engine prototype</h1>
      <p>
        <small>
          Paste everything you have about the company (registry extracts, filings, website text, press, job ads). The
          engine triangulates what is not disclosed and tags every claim with confidence.
        </small>
      </p>

      <form onSubmit={submit}>
        <p>
          <label>
            Company name
            <br />
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} size={60} required />
          </label>
        </p>
        <p>
          <label>
            Pasted data
            <br />
            <textarea value={rawData} onChange={(e) => setRawData(e.target.value)} rows={16} cols={100} required />
          </label>
        </p>
        <p>
          <label>
            Your private notes (optional — your own lawfully-held knowledge)
            <br />
            <textarea value={userNotes} onChange={(e) => setUserNotes(e.target.value)} rows={4} cols={100} />
          </label>
        </p>
        <p>
          <label>
            Lens{" "}
            <select value={lensId} onChange={(e) => setLensId(e.target.value)}>
              {LENSES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label} — {l.audience_description}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <button type="submit" disabled={loading}>
            {loading ? "Analysing (3 passes: draft → red-team → revise; this takes a few minutes)..." : "Analyse"}
          </button>
        </p>
      </form>

      {error && (
        <p>
          <strong>Error:</strong> {error}
        </p>
      )}

      {result && (
        <div>
          <hr />
          <p>
            <button type="button" onClick={downloadTrace}>
              Download full reasoning trace (JSON)
            </button>{" "}
            <small>
              trace {result.traceId} · config {result.configFingerprint} ·{" "}
              {result.steps.length} engine passes
            </small>
          </p>
          <CritiquePanel critique={result.critique} />
          <hr />
          <DossierView dossier={result.final} lens={lens} overrides={overrides} onOverride={handleOverride} />
        </div>
      )}
    </main>
  );
}
