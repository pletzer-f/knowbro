"use client";

// The research console — one page. Identity → sources → auto-gathered data →
// run. Data comes from the automated research (Phase 4 connectors + web
// research); the workspace is the editable *result*, never a blank box.
// Motion is brand-spec: quick, confident, no bounce; reduced-motion respected.

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisResult, LensConfig } from "@/engine/src/types";
import { resolveView } from "@/engine/src/lens";
import { withEdit, type DossierEdits } from "@/lib/edits";
import DossierView, { CritiquePanel, ConfidenceBadge, type Overrides } from "@/components/DossierView";
import ChatPanel, { type ChatMsg } from "@/components/ChatPanel";
import CountUp from "@/components/CountUp";

import investorLens from "@/engine/config/lenses/investor.json";
import entrepreneurLens from "@/engine/config/lenses/entrepreneur.json";
import curiousLens from "@/engine/config/lenses/curious.json";

const LENSES = [investorLens, entrepreneurLens, curiousLens] as LensConfig[];

type Phase = "draft" | "critique" | "revise";
const PHASE_LABEL: Record<Phase, string> = { draft: "Drafting analysis", critique: "Red-teaming", revise: "Revising" };

// Source connectors shown as console chips. `detect` marks a chip done when its
// signature appears in the streamed pack; `applies` hides irrelevant ones.
interface SourceDef {
  id: string;
  label: string;
  detect: RegExp;
  applies: (ctx: { isUk: boolean; isListed: boolean; peers: boolean }) => boolean;
}
const SOURCES: SourceDef[] = [
  { id: "web_research", label: "web research", detect: /SOURCES USED|SOURCE PACK/i, applies: () => true },
  { id: "companies_house_uk", label: "companies house", detect: /COMPANIES HOUSE/i, applies: (c) => c.isUk },
  { id: "sec_edgar", label: "sec edgar", detect: /SEC EDGAR/i, applies: (c) => c.isListed },
  { id: "fmp_market_data", label: "market data", detect: /MARKET SNAPSHOT|MODELING PREP/i, applies: (c) => c.isListed },
  { id: "gleif", label: "gleif", detect: /GLEIF/i, applies: () => true },
  { id: "peer_comps_web", label: "peer comps", detect: /PEER MULTIPLES|LISTED PEER/i, applies: (c) => c.peers },
];

const COST = {
  quick: { label: "Quick scan", est: "~€0.45 · ~3 min" },
  full: { label: "Full analysis", est: "~€1.30 · ~8 min" },
};

function Checkmark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeDasharray: 16, animation: "kb-draw var(--dur-base) var(--ease-out) both" }}
      />
    </svg>
  );
}

export default function ResearchConsole() {
  // Identity
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("");
  const [isListed, setIsListed] = useState(false);
  const [ticker, setTicker] = useState("");
  const [ukNumber, setUkNumber] = useState("");
  const [extraUrls, setExtraUrls] = useState("");

  // Sources (per-run overrides; default on)
  const [sourceOn, setSourceOn] = useState<Record<string, boolean>>(
    Object.fromEntries(SOURCES.map((s) => [s.id, true]))
  );
  const [sourceState, setSourceState] = useState<Record<string, "idle" | "gathering" | "done">>({});

  // Data
  const [rawData, setRawData] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [lastLoadedNote, setLastLoadedNote] = useState("");
  const [gathering, setGathering] = useState(false);

  // Run config
  const [lensId, setLensId] = useState("investor");
  const [viewId, setViewId] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<"quick" | "full">("full");

  // Run
  const [loading, setLoading] = useState(false);
  const [phaseStates, setPhaseStates] = useState<Partial<Record<Phase, "running" | "done">>>({});
  const [feed, setFeed] = useState<{ t: string; phase: string; text: string }[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // Post
  const [overrides, setOverrides] = useState<Overrides>({});
  const [edits, setEdits] = useState<DossierEdits>({});
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [chatTranscript, setChatTranscript] = useState<ChatMsg[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isUk = /^(uk|united kingdom|gb|great britain|england|scotland|wales)$/i.test(country.trim());
  const peers = sourceOn.peer_comps_web;
  const visibleSources = SOURCES.filter((s) => s.applies({ isUk, isListed, peers: true }));

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

  const gather = async () => {
    const company = companyName.trim();
    if (!company || gathering) return;
    setGathering(true);
    setError(null);
    loadNote();
    const applicable = visibleSources.filter((s) => sourceOn[s.id]);
    setSourceState(Object.fromEntries(applicable.map((s) => [s.id, "gathering"])));
    try {
      const res = await fetch("/api/gather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: company,
          country: country.trim() || undefined,
          companyNumber: ukNumber.trim() || undefined,
          urls: extraUrls.split("\n").map((u) => u.trim()).filter(Boolean),
          includePeerComps: sourceOn.peer_comps_web,
          isListed,
          ticker: ticker.trim() || undefined,
          sourceOverrides: sourceOn,
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
        // light-touch live status: mark a chip done when its signature appears
        setSourceState((prev) => {
          const next = { ...prev };
          for (const s of applicable) if (next[s.id] !== "done" && s.detect.test(snapshot)) next[s.id] = "done";
          return next;
        });
      }
      setSourceState((prev) => {
        const next = { ...prev };
        for (const s of applicable) next[s.id] = "done";
        return next;
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGathering(false);
    }
  };

  const pushFeed = (phase: string, text: string) =>
    setFeed((f) => [...f, { t: `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`, phase, text }]);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSavedId(null);
    setEdits({});
    setPhaseStates({});
    setFeed([]);
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
        body: JSON.stringify({ companyName, rawData, userNotes, quickScan: mode === "quick" }),
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
          const ev = JSON.parse(line);
          if (ev.type === "progress") {
            const phase = ev.phase as Phase;
            setPhaseStates((p) => ({ ...p, [phase]: ev.state === "start" ? "running" : "done" }));
            if (ev.state === "start") {
              pushFeed(phase, `${PHASE_LABEL[phase]}…`);
            } else {
              const d = ev.detail || {};
              let text = `${PHASE_LABEL[phase]} complete`;
              if (phase === "draft") text = `Draft complete — ${d.sections ?? 7} sections, ${d.estimates ?? "?"} estimates`;
              else if (phase === "critique")
                text = `Red-team raised ${d.findings ?? 0} finding${d.findings === 1 ? "" : "s"}${d.highFindings ? ` (${d.highFindings} high-severity)` : ""}`;
              else if (phase === "revise") text = d.note ? `Revision — ${d.note}` : "Revision applied";
              pushFeed(phase, text);
            }
          } else if (ev.type === "result") {
            setResult(ev.result as AnalysisResult);
            pushFeed("done", "Dossier ready");
          } else if (ev.type === "error") {
            throw new Error(ev.error);
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

  const lens = LENSES.find((l) => l.id === lensId) ?? LENSES[0];
  const view = resolveView(lens, viewId);
  const tokenEst = Math.round(rawData.length / 4);
  const gatheredOnce = Object.values(sourceState).some((s) => s === "done");

  const stats = useMemo(() => {
    if (!result) return null;
    const d = result.final;
    const estimates =
      d.business_model.estimates.length +
      d.ownership_control.estimates.length +
      d.financial_picture.estimates.length +
      d.capital_structure_health.estimates.length +
      d.investment_angle.estimates.length;
    return {
      estimates,
      dealKillers: d.conclusions.deal_killers.length,
      unknowns: d.what_we_dont_know.items.length,
      keyNumbers: d.snapshot.key_numbers.length,
      confidence: d.snapshot.overall_confidence,
    };
  }, [result]);

  return (
    <main>
      {/* Command bar — the dossier cover forming */}
      <p className="kb-eyebrow">Research</p>
      <input
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        onBlur={loadNote}
        placeholder="Company name"
        aria-label="Company name"
        className={`kb-console-title ${companyName ? "" : "kb-placeholder"}`}
        style={{ border: "none", background: "transparent", padding: 0, width: "100%", outline: "none" }}
      />
      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", alignItems: "center", marginTop: "var(--space-3)" }}>
        <label>
          Country{" "}
          <input value={country} onChange={(e) => setCountry(e.target.value)} size={14} placeholder="e.g. Austria, US" />
        </label>
        <label>
          <input type="checkbox" checked={isListed} onChange={(e) => setIsListed(e.target.checked)} /> publicly listed
        </label>
        {isListed && (
          <label>
            Ticker <input value={ticker} onChange={(e) => setTicker(e.target.value)} size={9} placeholder="NIBE-B.ST" />
          </label>
        )}
        {isUk && (
          <label>
            CH number <input value={ukNumber} onChange={(e) => setUkNumber(e.target.value)} size={10} />
          </label>
        )}
      </div>

      {/* Sources strip */}
      <h4>Sources</h4>
      <div className="kb-source-strip">
        {visibleSources.map((s) => (
          <button
            key={s.id}
            type="button"
            className="kb-source-chip"
            data-on={sourceOn[s.id]}
            data-state={sourceState[s.id] ?? "idle"}
            onClick={() => setSourceOn((p) => ({ ...p, [s.id]: !p[s.id] }))}
            title={sourceOn[s.id] ? "Included — click to exclude this run" : "Excluded — click to include"}
          >
            <span className="st" />
            {s.label}
          </button>
        ))}
      </div>
      <p style={{ marginTop: "var(--space-3)" }}>
        <button type="button" className="primary" onClick={gather} disabled={gathering || !companyName.trim()}>
          {gathering ? "Gathering…" : gatheredOnce ? "Re-gather public data" : "Gather public data"}
        </button>{" "}
        <span className="kb-meter">
          public sources only · review before running
        </span>
      </p>

      {/* Data workspace — the gathered pack (editable) */}
      <h4>
        Source pack{" "}
        {rawData.trim() && (
          <span className="kb-meter">· {rawData.length.toLocaleString()} chars · ~{tokenEst.toLocaleString()} tokens</span>
        )}
      </h4>
      <textarea
        value={rawData}
        onChange={(e) => setRawData(e.target.value)}
        rows={14}
        style={{ width: "100%" }}
        placeholder="Gathered public data appears here. You can edit or paste more before running — this is exactly what the engine sees."
        className={gathering ? "kb-caret" : ""}
      />
      <details>
        <summary>Attach specific pages &amp; private notes</summary>
        <p style={{ marginTop: "var(--space-3)" }}>
          <label>
            Specific URLs to include (one per line)
            <br />
            <textarea value={extraUrls} onChange={(e) => setExtraUrls(e.target.value)} rows={2} style={{ width: "100%" }} />
          </label>
        </p>
        <p>
          <label>
            Your private notes (lawfully-held knowledge; saved per company, reused on future runs)
            <br />
            <textarea value={userNotes} onChange={(e) => setUserNotes(e.target.value)} rows={3} style={{ width: "100%" }} />
          </label>
        </p>
      </details>

      {/* Sticky run bar */}
      {!result && !loading && (
        <div className="kb-runbar kb-reveal">
          <label>
            Lens{" "}
            <select value={lensId} onChange={(e) => { setLensId(e.target.value); setViewId(undefined); }}>
              {LENSES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </label>
          <span className="kb-segmented">
            {(["quick", "full"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
                {COST[m].label}
              </button>
            ))}
          </span>
          <span className="kb-cost">{COST[mode].est}</span>
          <span className="kb-runbar-spacer" />
          <button type="button" className="primary" onClick={run} disabled={!rawData.trim()}>
            Build dossier
          </button>
        </div>
      )}

      {/* Live run */}
      {loading && (
        <section className="kb-reveal" style={{ marginTop: "var(--space-6)" }}>
          <div className="kb-phases">
            {(Object.keys(PHASE_LABEL) as Phase[])
              .filter((p) => mode === "full" || p === "draft")
              .map((p) => {
                const st = phaseStates[p] ?? "idle";
                return (
                  <div key={p} className="kb-phase" data-state={st}>
                    <span className="mk">
                      {st === "done" ? <Checkmark /> : <span className={`dot ${st === "running" ? "kb-pulse-dot" : ""}`} />}
                    </span>
                    <span>{PHASE_LABEL[p]}</span>
                  </div>
                );
              })}
          </div>
          <p className="kb-meter">running {Math.floor(elapsed / 60)}m {elapsed % 60}s · {mode === "quick" ? "quick scan, no red-team" : "draft → red-team → revise"}</p>
          {feed.length > 0 && (
            <ul className="kb-feed" style={{ marginTop: "var(--space-3)" }}>
              {feed.map((f, i) => (
                <li key={i} className="kb-reveal-fade">
                  <span className="t">{f.t}</span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {error && (
        <p style={{ marginTop: "var(--space-4)" }}>
          <strong>Error:</strong> {error}{" "}
          <button type="button" className="kb-mini" onClick={run}>retry</button>
        </p>
      )}

      {/* Result */}
      {result && stats && (
        <section className="kb-reveal" style={{ marginTop: "var(--space-6)" }}>
          <hr />
          {/* Dossier cover stats — number reveals */}
          <div style={{ display: "flex", gap: "var(--space-8)", flexWrap: "wrap", alignItems: "baseline", margin: "var(--space-2) 0 var(--space-4)" }}>
            <span><CountUp value={stats.estimates} /> <span className="kb-meter">estimates</span></span>
            <span><CountUp value={stats.dealKillers} /> <span className="kb-meter">deal-killers</span></span>
            <span><CountUp value={stats.unknowns} /> <span className="kb-meter">open questions</span></span>
            <ConfidenceBadge confidence={stats.confidence} label="overall" />
          </div>
          <p>
            <button type="button" className="primary" disabled={saving || savedId !== null} onClick={saveDossier}>
              {savedId ? "Saved" : saving ? "Saving…" : "Save dossier"}
            </button>{" "}
            {savedId && <a href={`/dossiers/${savedId}`}>open saved dossier</a>}{" "}
            <label style={{ marginLeft: "var(--space-4)" }}>
              Lens{" "}
              <select value={lensId} onChange={(e) => { setLensId(e.target.value); setViewId(undefined); }}>
                {LENSES.map((l) => (<option key={l.id} value={l.id}>{l.label}</option>))}
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
          <div className="kb-reveal-confs">
            <DossierView
              dossier={result.final}
              lens={lens}
              view={view}
              overrides={overrides}
              onOverride={handleOverride}
              edits={edits}
              onEdit={(path, value) => setEdits((prev) => withEdit(prev, path, value))}
            />
          </div>
          <hr />
          {savedId ? (
            <p>Chat moved to the <a href={`/dossiers/${savedId}`}>saved dossier</a> — it continues there.</p>
          ) : (
            <ChatPanel result={result} companyName={result.input.companyName} onTranscriptChange={setChatTranscript} />
          )}
          <details>
            <summary>Engine room — how this dossier was made</summary>
            <p className="kb-meter">trace {result.traceId} · config {result.configFingerprint} · {result.steps.length} passes</p>
            <CritiquePanel critique={result.critique} />
          </details>
        </section>
      )}
    </main>
  );
}
