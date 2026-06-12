"use client";

// Phase-1 surface: paste data, run the engine, inspect the dossier.
// Deliberately unstyled — see docs/SPEC.md.

import { useEffect, useState } from "react";
import type { AnalysisResult, LensConfig } from "@/engine/src/types";
import { resolveView } from "@/engine/src/lens";
import { withEdit, type DossierEdits } from "@/lib/edits";
import DossierView, { CritiquePanel, type Overrides } from "@/components/DossierView";
import ChatPanel, { type ChatMsg } from "@/components/ChatPanel";

import investorLens from "@/engine/config/lenses/investor.json";
import entrepreneurLens from "@/engine/config/lenses/entrepreneur.json";
import curiousLens from "@/engine/config/lenses/curious.json";

const LENSES = [investorLens, entrepreneurLens, curiousLens] as LensConfig[];

export default function Home() {
  const [companyName, setCompanyName] = useState("");
  const [rawData, setRawData] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [lensId, setLensId] = useState("investor");
  const [viewId, setViewId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastLoadedNote, setLastLoadedNote] = useState("");
  const [chatTranscript, setChatTranscript] = useState<ChatMsg[]>([]);
  const [edits, setEdits] = useState<DossierEdits>({});
  const [country, setCountry] = useState("");
  const [ukNumber, setUkNumber] = useState("");
  const [extraUrls, setExtraUrls] = useState("");
  const [withPeerComps, setWithPeerComps] = useState(true);
  const [isListed, setIsListed] = useState(false);
  const [ticker, setTicker] = useState("");
  const [gathering, setGathering] = useState(false);

  // "Run a new analysis" links from a company page prefill the name.
  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get("company");
    if (prefill) setCompanyName(prefill);
  }, []);

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

  // The note is the per-company private-context store: prefill it when a
  // company name is entered (unless the user already typed something new).
  const loadNote = async () => {
    const company = companyName.trim();
    if (!company) return;
    const res = await fetch(`/api/notes?company=${encodeURIComponent(company)}`);
    if (!res.ok) return;
    const { content } = await res.json();
    if (content && (userNotes.trim() === "" || userNotes === lastLoadedNote)) {
      setUserNotes(content);
      setLastLoadedNote(content);
    }
  };

  // Auto-gather: streams the assembled public-data pack into the paste box,
  // where the user reviews/edits it before running the engine.
  const fetchPublicData = async () => {
    const company = companyName.trim();
    if (!company || gathering) return;
    setGathering(true);
    setError(null);
    try {
      const res = await fetch("/api/gather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: company,
          country: country.trim() || undefined,
          companyNumber: ukNumber.trim() || undefined,
          urls: extraUrls
            .split("\n")
            .map((u) => u.trim())
            .filter(Boolean),
          includePeerComps: withPeerComps,
          isListed,
          ticker: ticker.trim() || undefined,
        }),
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let collected = rawData.trim() ? rawData + "\n\n" : "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        collected += decoder.decode(value, { stream: true });
        const snapshot = collected;
        setRawData(snapshot);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGathering(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setSavedId(null);
    setEdits({});
    // Persist the note so it's reusable on future analyses of this company.
    if (userNotes.trim()) {
      fetch("/api/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: companyName.trim(), content: userNotes }),
      }).catch(() => {});
    }
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
  const view = resolveView(lens, viewId);

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
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} onBlur={loadNote} size={60} required />
          </label>
        </p>
        <fieldset>
          <legend>Fetch public data automatically (optional)</legend>
          <p>
            <label>
              Country{" "}
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                size={16}
                placeholder="e.g. Austria, UK"
              />
            </label>{" "}
            <label>
              UK company number (if known){" "}
              <input value={ukNumber} onChange={(e) => setUkNumber(e.target.value)} size={12} />
            </label>{" "}
            <label>
              <input type="checkbox" checked={withPeerComps} onChange={(e) => setWithPeerComps(e.target.checked)} />{" "}
              also collect listed-peer multiples
            </label>
          </p>
          <p>
            <label>
              <input type="checkbox" checked={isListed} onChange={(e) => setIsListed(e.target.checked)} /> publicly
              listed company
            </label>{" "}
            {isListed && (
              <label>
                Ticker <input value={ticker} onChange={(e) => setTicker(e.target.value)} size={8} placeholder="AAPL" />
              </label>
            )}
          </p>
          <p>
            <label>
              Specific pages to include (optional, one URL per line)
              <br />
              <textarea value={extraUrls} onChange={(e) => setExtraUrls(e.target.value)} rows={2} cols={100} />
            </label>
          </p>
          <p>
            <button type="button" onClick={fetchPublicData} disabled={gathering || !companyName.trim()}>
              {gathering ? "Gathering (1-3 minutes, streams in below)..." : "Fetch public data"}
            </button>{" "}
            <small>
              Searches public sources only and writes into the box below — review before analysing. Honours your
              source preferences.
            </small>
          </p>
        </fieldset>
        <p>
          <label>
            Pasted data
            <br />
            <textarea value={rawData} onChange={(e) => setRawData(e.target.value)} rows={16} cols={100} required />
          </label>
        </p>
        <p>
          <label>
            Your private notes (optional — your own lawfully-held knowledge; saved per company and reused on future analyses)
            <br />
            <textarea value={userNotes} onChange={(e) => setUserNotes(e.target.value)} rows={4} cols={100} />
          </label>
        </p>
        <p>
          <label>
            Lens{" "}
            <select
              value={lensId}
              onChange={(e) => {
                setLensId(e.target.value);
                setViewId(undefined); // back to the lens's default view
              }}
            >
              {LENSES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label} — {l.audience_description}
                </option>
              ))}
            </select>
          </label>
        </p>
        {lens.views.length > 1 && (
          <p>
            View:{" "}
            {lens.views.map((v) => (
              <label key={v.id} title={v.tagline}>
                <input
                  type="radio"
                  name="view"
                  checked={view.id === v.id}
                  onChange={() => setViewId(v.id)}
                />
                {v.label} <small>({v.tagline})</small>{" "}
              </label>
            ))}
          </p>
        )}
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
            <button
              type="button"
              disabled={saving || savedId !== null}
              onClick={async () => {
                setSaving(true);
                const res = await fetch("/api/dossiers", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  // Chat + edits so far are saved with the dossier and continue there.
                  body: JSON.stringify({ result, overrides, edits, chat: chatTranscript }),
                });
                const json = await res.json();
                setSaving(false);
                if (res.ok) setSavedId(json.id);
                else setError(json.error);
              }}
            >
              {savedId ? "Saved" : saving ? "Saving..." : "Save dossier"}
            </button>{" "}
            {savedId && <a href={`/dossiers/${savedId}`}>open saved dossier</a>}{" "}
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
          <DossierView
            dossier={result.final}
            lens={lens}
            view={view}
            overrides={overrides}
            onOverride={handleOverride}
            edits={edits}
            onEdit={(path, value) => setEdits((prev) => withEdit(prev, path, value))}
          />
          <hr />
          {savedId ? (
            <p>
              Chat moved to the <a href={`/dossiers/${savedId}`}>saved dossier</a> — it continues there.
            </p>
          ) : (
            <ChatPanel result={result} companyName={result.input.companyName} onTranscriptChange={setChatTranscript} />
          )}
        </div>
      )}
    </main>
  );
}
