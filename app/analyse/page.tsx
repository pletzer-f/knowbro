"use client";

// Researching a new company — guided three-step flow:
//   1. Who is it      (name, country, listed/ticker)
//   2. Get the data   (auto-fetch streams in; review/trim; add your own material + notes)
//   3. Run & read     (live pass-by-pass progress, then the dossier, reader-first)
// Deliberately unstyled; structure only.

import { useEffect, useRef, useState } from "react";
import type { AnalysisResult, LensConfig } from "@/engine/src/types";
import { resolveView } from "@/engine/src/lens";
import { withEdit, type DossierEdits } from "@/lib/edits";
import DossierView, { CritiquePanel, type Overrides } from "@/components/DossierView";
import ChatPanel, { type ChatMsg } from "@/components/ChatPanel";

import investorLens from "@/engine/config/lenses/investor.json";
import entrepreneurLens from "@/engine/config/lenses/entrepreneur.json";
import curiousLens from "@/engine/config/lenses/curious.json";

const LENSES = [investorLens, entrepreneurLens, curiousLens] as LensConfig[];

type Step = 1 | 2 | 3;
type Phase = "draft" | "critique" | "revise";
const PHASE_LABELS: Record<Phase, string> = {
  draft: "Drafting the analysis (all inference chains)",
  critique: "Red-teaming the draft (skeptical second analyst)",
  revise: "Revising with the critique applied",
};

export default function AnalysePage() {
  const [step, setStep] = useState<Step>(1);

  // Step 1 — who
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("");
  const [isListed, setIsListed] = useState(false);
  const [ticker, setTicker] = useState("");

  // Step 2 — data
  const [rawData, setRawData] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [lastLoadedNote, setLastLoadedNote] = useState("");
  const [ukNumber, setUkNumber] = useState("");
  const [extraUrls, setExtraUrls] = useState("");
  const [withPeerComps, setWithPeerComps] = useState(true);
  const [gathering, setGathering] = useState(false);

  // Step 3 — run & read
  const [loading, setLoading] = useState(false);
  const [phaseStates, setPhaseStates] = useState<Partial<Record<Phase, "running" | "done">>>({});
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [edits, setEdits] = useState<DossierEdits>({});
  const [lensId, setLensId] = useState("investor");
  const [viewId, setViewId] = useState<string | undefined>(undefined);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [chatTranscript, setChatTranscript] = useState<ChatMsg[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get("company");
    if (prefill) setCompanyName(prefill);
  }, []);

  useEffect(() => {
    if (loading) {
      const started = Date.now();
      timerRef.current = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

  const overridesKey = result ? `wba-overrides:${result.input.companyName}` : null;
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

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSavedId(null);
    setEdits({});
    setPhaseStates({});
    setElapsed(0);

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
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "progress") {
            setPhaseStates((prev) => ({ ...prev, [event.phase as Phase]: event.state === "start" ? "running" : "done" }));
          } else if (event.type === "result") {
            setResult(event.result as AnalysisResult);
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const saveDossier = async () => {
    if (!result) return;
    setSaving(true);
    const res = await fetch("/api/dossiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result, overrides, edits, chat: chatTranscript }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) setSavedId(json.id);
    else setError(json.error);
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
      <h1>Research a company</h1>
      <p>
        <small>
          Step {step} of 3: {step === 1 ? "who is it" : step === 2 ? "get the data" : "run & read"}
        </small>
      </p>

      {step === 1 && (
        <div>
          <p>
            <label>
              Company name (official legal name)
              <br />
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} size={60} autoFocus />
            </label>
          </p>
          <p>
            <label>
              Country / home market{" "}
              <input value={country} onChange={(e) => setCountry(e.target.value)} size={16} placeholder="e.g. Austria, UK, US" />
            </label>
          </p>
          <p>
            <label>
              <input type="checkbox" checked={isListed} onChange={(e) => setIsListed(e.target.checked)} /> publicly
              listed
            </label>{" "}
            {isListed && (
              <label>
                Ticker <input value={ticker} onChange={(e) => setTicker(e.target.value)} size={10} placeholder="e.g. NIBE-B.ST" />
              </label>
            )}
          </p>
          <p>
            <button
              type="button"
              disabled={!companyName.trim()}
              onClick={() => {
                loadNote();
                setStep(2);
              }}
            >
              Next: get the data →
            </button>
          </p>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3>{companyName}</h3>
          <p>
            <button type="button" onClick={fetchPublicData} disabled={gathering}>
              {gathering ? "Gathering public data (1–3 min, streams in below)..." : "Fetch public data automatically"}
            </button>{" "}
            <small>Public sources only; honours your source preferences. Review before running.</small>
          </p>
          <details>
            <summary>Fetch options</summary>
            <p>
              <label>
                UK company number (if known) <input value={ukNumber} onChange={(e) => setUkNumber(e.target.value)} size={12} />
              </label>{" "}
              <label>
                <input type="checkbox" checked={withPeerComps} onChange={(e) => setWithPeerComps(e.target.checked)} />{" "}
                also collect listed-peer multiples
              </label>
            </p>
            <p>
              <label>
                Specific pages to include (one URL per line)
                <br />
                <textarea value={extraUrls} onChange={(e) => setExtraUrls(e.target.value)} rows={2} cols={100} />
              </label>
            </p>
          </details>
          <p>
            <label>
              Source material (auto-fetched and/or pasted — edit freely; this is exactly what the engine sees)
              <br />
              <textarea value={rawData} onChange={(e) => setRawData(e.target.value)} rows={16} cols={100} />
            </label>
          </p>
          <p>
            <label>
              Your private notes (optional — your own lawfully-held knowledge; saved per company, reused on future runs)
              <br />
              <textarea value={userNotes} onChange={(e) => setUserNotes(e.target.value)} rows={4} cols={100} />
            </label>
          </p>
          <p>
            <button type="button" onClick={() => setStep(1)}>
              ← Back
            </button>{" "}
            <button type="button" disabled={!rawData.trim()} onClick={() => setStep(3)}>
              Next: run the analysis →
            </button>
          </p>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3>{companyName}</h3>
          {!result && !loading && (
            <p>
              <button type="button" onClick={() => setStep(2)}>
                ← Back to data
              </button>{" "}
              <button type="button" onClick={run}>
                Run the analysis (≈5–10 minutes, ~€1–2)
              </button>
            </p>
          )}

          {(loading || result) && (
            <div>
              <p>
                {(Object.keys(PHASE_LABELS) as Phase[]).map((p) => (
                  <span key={p}>
                    {phaseStates[p] === "done" ? "✓" : phaseStates[p] === "running" ? "▶" : "·"} {PHASE_LABELS[p]}
                    <br />
                  </span>
                ))}
                {loading && <small>running for {elapsed}s...</small>}
              </p>
            </div>
          )}

          {error && (
            <p>
              <strong>Error:</strong> {error}{" "}
              <button type="button" onClick={run}>
                retry
              </button>
            </p>
          )}

          {result && (
            <div>
              <hr />
              <p>
                <button type="button" disabled={saving || savedId !== null} onClick={saveDossier}>
                  {savedId ? "Saved" : saving ? "Saving..." : "Save dossier"}
                </button>{" "}
                {savedId && <a href={`/dossiers/${savedId}`}>open saved dossier</a>}{" "}
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
              <hr />
              <details>
                <summary>Engine room — how this dossier was made</summary>
                <p>
                  <button type="button" onClick={downloadTrace}>
                    Download full reasoning trace (JSON)
                  </button>{" "}
                  <small>
                    trace {result.traceId} · config {result.configFingerprint} · {result.steps.length} engine passes
                  </small>
                </p>
                <CritiquePanel critique={result.critique} />
              </details>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
