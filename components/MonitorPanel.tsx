"use client";

// Monitoring controls for a company: watch toggle + cadence, "Check now"
// (streams the funnel: re-gather → triage → maybe re-analyze), and the latest
// change with its delta. Unstyled-but-branded; uses the global element layer.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface DossierDelta {
  verdict_changed?: boolean;
  health_changed?: { from: string; to: string } | null;
  confidence_shifts?: { id: string; label: string; from: string; to: string; direction: "up" | "down" }[];
  deal_killers_added?: string[];
  deal_killers_removed?: string[];
  has_changes?: boolean;
}
interface WatchRow {
  company_id: string;
  cadence: string;
  enabled: boolean;
  last_checked_at: string | null;
  next_check_at: string | null;
  last_run: { ran_at: string; status: string; summary: string } | null;
}

const CADENCES = ["manual", "weekly", "monthly", "quarterly"] as const;

export default function MonitorPanel({ companyId, hasDossier }: { companyId: string; hasDossier: boolean }) {
  const [watch, setWatch] = useState<WatchRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; summary: string; dossierId: string | null } | null>(null);
  const [delta, setDelta] = useState<DossierDelta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const elapsedRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  const load = async () => {
    const res = await fetch("/api/watchlist");
    if (res.ok) {
      const { watchlist } = await res.json();
      setWatch(watchlist.find((w: WatchRow) => w.company_id === companyId) ?? null);
    }
    setLoaded(true);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    if (!checking) return;
    elapsedRef.current = 0;
    const t = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, [checking]);

  const setWatchState = async (patch: { cadence?: string; enabled?: boolean }) => {
    const next = {
      company_id: companyId,
      cadence: patch.cadence ?? watch?.cadence ?? "monthly",
      enabled: patch.enabled ?? watch?.enabled ?? true,
    };
    setWatch((w) => ({ ...(w ?? { company_id: companyId, last_checked_at: null, next_check_at: null, last_run: null }), ...next }));
    await fetch("/api/watchlist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    load();
  };

  const stopWatching = async () => {
    await fetch(`/api/watchlist?company_id=${companyId}`, { method: "DELETE" });
    setWatch(null);
  };

  const checkNow = async () => {
    setChecking(true);
    setError(null);
    setResult(null);
    setDelta(null);
    setPhase("starting");
    try {
      const res = await fetch(`/api/companies/${companyId}/check`, { method: "POST" });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "progress") setPhase(ev.note || ev.phase);
          else if (ev.type === "result") setResult(ev.outcome);
          else if (ev.type === "error") throw new Error(ev.error);
        }
      }
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
      setPhase(null);
    }
  };

  // Pull the delta of the most recent changed run for display.
  useEffect(() => {
    if (result?.status === "changed") {
      fetch("/api/changes")
        .then((r) => r.json())
        .then((j) => {
          const mine = (j.changes || []).find((c: { company_id: string }) => c.company_id === companyId);
          if (mine?.delta) setDelta(mine.delta);
        })
        .catch(() => {});
    }
  }, [result, companyId]);

  if (!loaded) return <p className="kb-meter">Loading monitor…</p>;

  const watching = !!watch;

  return (
    <div>
      <h3>Monitoring</h3>
      {!hasDossier ? (
        <p className="kb-meter">Analyse this company once to set a baseline, then you can monitor it for changes.</p>
      ) : (
        <>
          <p>
            {watching ? (
              <>
                <strong>Watching</strong> · check{" "}
                <select value={watch!.cadence} onChange={(e) => setWatchState({ cadence: e.target.value })}>
                  {CADENCES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>{" "}
                <button type="button" className="kb-mini" onClick={stopWatching}>stop watching</button>
              </>
            ) : (
              <button type="button" onClick={() => setWatchState({ enabled: true, cadence: "monthly" })}>
                Watch this company
              </button>
            )}{" "}
            <button type="button" className="primary" onClick={checkNow} disabled={checking}>
              {checking ? "Checking…" : "Check now"}
            </button>
          </p>

          {watching && (
            <p className="kb-meter">
              {watch!.last_checked_at ? `last checked ${new Date(watch!.last_checked_at).toLocaleString()}` : "not checked yet"}
              {watch!.next_check_at ? ` · next ${new Date(watch!.next_check_at).toLocaleDateString()}` : ""}
            </p>
          )}

          {checking && (
            <p className="kb-reveal-fade">
              <span className="kb-data">{Math.floor(elapsed / 60)}m {elapsed % 60}s</span> · {phase}
              <br />
              <small className="kb-meter">re-gather → triage → re-analyse only if something material changed</small>
            </p>
          )}

          {error && <p><strong>Error:</strong> {error}</p>}

          {result && (
            <div className="kb-reveal">
              <p>
                {result.status === "changed" ? (
                  <strong>Change detected.</strong>
                ) : result.status === "no_change" ? (
                  <strong>No material change.</strong>
                ) : (
                  <strong>Couldn’t complete.</strong>
                )}{" "}
                {result.summary}{" "}
                {result.dossierId && <Link href={`/dossiers/${result.dossierId}`}>open updated dossier</Link>}
              </p>
              {delta && delta.has_changes && (
                <ul>
                  {delta.health_changed && (
                    <li>Health verdict: {delta.health_changed.from.replace(/_/g, " ")} → {delta.health_changed.to.replace(/_/g, " ")}</li>
                  )}
                  {(delta.confidence_shifts ?? []).map((s, i) => (
                    <li key={i}>
                      Confidence on <strong>{s.label}</strong>: {s.from} → {s.to}{" "}
                      <span style={{ color: s.direction === "down" ? "var(--conf-low-fg)" : "var(--conf-high-fg)" }}>
                        ({s.direction})
                      </span>
                    </li>
                  ))}
                  {(delta.deal_killers_added ?? []).map((t, i) => (
                    <li key={`a${i}`}>New deal-killer: {t}</li>
                  ))}
                  {(delta.deal_killers_removed ?? []).map((t, i) => (
                    <li key={`r${i}`}>Deal-killer resolved: {t}</li>
                  ))}
                  {delta.verdict_changed && <li>The verdict was revised.</li>}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
