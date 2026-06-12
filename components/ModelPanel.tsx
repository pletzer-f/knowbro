"use client";

// The company's living financial model. All math is deterministic and local
// (lib/model.ts) — it recalculates on every keystroke. The promptable metrics
// area at the bottom is the only LLM-backed part.

import { useMemo, useRef, useState } from "react";
import type { Dossier } from "@/engine/src/types";
import {
  defaultParams,
  peerValuation,
  runScenario,
  seedFromDossier,
  sensitivity,
  SCENARIO_KEYS,
  type ModelParams,
  type ScenarioKey,
} from "@/lib/model";

interface CustomMetric {
  prompt: string;
  response: string;
  created_at: string;
}

const fmt = (n: number, digits = 1) =>
  Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—";

function NumInput({
  value,
  onChange,
  step = 1,
  width = 7,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  width?: number;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      style={{ width: `${width}ch` }}
    />
  );
}

export default function ModelPanel({
  companyId,
  initialParams,
  initialMetrics,
  latestDossier,
}: {
  companyId: string;
  initialParams: ModelParams | null;
  initialMetrics: CustomMetric[];
  latestDossier: Dossier | null;
}) {
  const [params, setParams] = useState<ModelParams | null>(initialParams);
  const [seedNotes, setSeedNotes] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEquityMatrix, setShowEquityMatrix] = useState(false);
  const [metrics, setMetrics] = useState<CustomMetric[]>(initialMetrics);
  const [metricPrompt, setMetricPrompt] = useState("");
  const [metricStream, setMetricStream] = useState<string | null>(null);
  const metricBusy = useRef(false);

  const update = (fn: (p: ModelParams) => ModelParams) => {
    setParams((prev) => (prev ? fn(prev) : prev));
    setDirty(true);
  };

  const results = useMemo(() => {
    if (!params || params.base_revenue_m <= 0) return null;
    return {
      scenarios: Object.fromEntries(SCENARIO_KEYS.map((k) => [k, runScenario(params, params.scenarios[k])])),
      sens: sensitivity(params),
      peers: peerValuation(params),
    };
  }, [params]);

  const save = async () => {
    if (!params) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/companies/${companyId}/model`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params }),
    });
    setSaving(false);
    if (!res.ok) setError((await res.json()).error);
    else setDirty(false);
  };

  const runMetricPrompt = async () => {
    const prompt = metricPrompt.trim();
    if (!prompt || metricBusy.current || !params) return;
    metricBusy.current = true;
    setMetricStream("");
    setError(null);
    try {
      const res = await fetch(`/api/companies/${companyId}/model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, modelParams: params, modelOutputs: results?.scenarios ?? {} }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json()).error || `HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        const snapshot = answer;
        setMetricStream(snapshot);
      }
      setMetrics((prev) => [...prev, { prompt, response: answer, created_at: new Date().toISOString() }]);
      setMetricStream(null);
      setMetricPrompt("");
    } catch (e) {
      setError((e as Error).message);
      setMetricStream(null);
    } finally {
      metricBusy.current = false;
    }
  };

  const deleteMetric = async (idx: number) => {
    const next = metrics.filter((_, i) => i !== idx);
    setMetrics(next);
    await fetch(`/api/companies/${companyId}/model`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom_metrics: next }),
    });
  };

  if (!params) {
    return (
      <div>
        <h3>Financial model</h3>
        <p>
          <small>No model yet for this company.</small>
        </p>
        <button
          type="button"
          disabled={!latestDossier}
          onClick={() => {
            if (!latestDossier) return;
            const seeded = seedFromDossier(latestDossier);
            setParams(seeded.params);
            setSeedNotes(seeded.notes);
            setDirty(true);
          }}
        >
          Seed from latest dossier
        </button>{" "}
        <button
          type="button"
          onClick={() => {
            setParams(defaultParams());
            setDirty(true);
          }}
        >
          Start blank
        </button>
      </div>
    );
  }

  const c = params.currency;
  const sc = params.scenarios;

  return (
    <div>
      <h3>
        Financial model{" "}
        <button type="button" onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving..." : dirty ? "Save model (unsaved changes)" : "Saved"}
        </button>
      </h3>
      {error && (
        <p>
          <strong>Error:</strong> {error}
        </p>
      )}
      {seedNotes.length > 0 && (
        <details open>
          <summary>Seeded from the dossier — verify these values</summary>
          <ul>
            {seedNotes.map((n, i) => (
              <li key={i}>
                <small>{n}</small>
              </li>
            ))}
          </ul>
        </details>
      )}

      <h4>Assumptions</h4>
      <p>
        Base year <NumInput value={params.base_year} onChange={(v) => update((p) => ({ ...p, base_year: v }))} width={6} />{" "}
        · Base revenue ({c}m){" "}
        <NumInput value={params.base_revenue_m} onChange={(v) => update((p) => ({ ...p, base_revenue_m: v }))} /> · Net
        debt today ({c}m) <NumInput value={params.net_debt_m} onChange={(v) => update((p) => ({ ...p, net_debt_m: v }))} />{" "}
        · Horizon (years){" "}
        <NumInput value={params.horizon_years} onChange={(v) => update((p) => ({ ...p, horizon_years: Math.max(1, Math.min(10, Math.round(v))) }))} width={4} />
      </p>
      <p>
        Deal (optional): Entry EV ({c}m){" "}
        <NumInput value={params.entry_ev_m} onChange={(v) => update((p) => ({ ...p, entry_ev_m: v }))} /> · Debt % of
        entry <NumInput value={params.debt_pct_of_entry} onChange={(v) => update((p) => ({ ...p, debt_pct_of_entry: v }))} width={5} />{" "}
        · Interest %{" "}
        <NumInput value={params.interest_rate_pct} onChange={(v) => update((p) => ({ ...p, interest_rate_pct: v }))} width={5} step={0.5} />{" "}
        · EBITDA→FCF conversion %{" "}
        <NumInput value={params.cash_conversion_pct} onChange={(v) => update((p) => ({ ...p, cash_conversion_pct: v }))} width={5} />
        <br />
        <small>
          Set Entry EV to 0 to model the company standalone (debt path starts from today's net debt). FCF conversion is
          a proxy for tax, capex and working capital combined.
        </small>
      </p>

      <h4>Scenarios</h4>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th></th>
            {SCENARIO_KEYS.map((k) => (
              <th key={k}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(
            [
              ["Revenue growth % p.a.", "growth_pct", 0.5],
              ["EBITDA margin %", "ebitda_margin_pct", 0.5],
              ["Exit multiple (EV/EBITDA)", "exit_multiple", 0.5],
            ] as [string, keyof typeof sc.base, number][]
          ).map(([label, field, step]) => (
            <tr key={field}>
              <td>{label}</td>
              {SCENARIO_KEYS.map((k) => (
                <td key={k}>
                  <NumInput
                    value={sc[k][field]}
                    step={step}
                    width={6}
                    onChange={(v) =>
                      update((p) => ({
                        ...p,
                        scenarios: { ...p.scenarios, [k]: { ...p.scenarios[k], [field]: v } },
                      }))
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {!results ? (
        <p>
          <em>Set a base revenue above 0 to compute outputs.</em>
        </p>
      ) : (
        <div>
          <h4>Outcomes per scenario ({c}m)</h4>
          <table border={1} cellPadding={4}>
            <thead>
              <tr>
                <th></th>
                <th>Exit EBITDA</th>
                <th>Exit EV</th>
                <th>Exit equity</th>
                {params.entry_ev_m > 0 && (
                  <>
                    <th>Entry equity</th>
                    <th>MoIC</th>
                    <th>IRR</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {SCENARIO_KEYS.map((k) => {
                const r = results.scenarios[k as ScenarioKey];
                return (
                  <tr key={k}>
                    <td>
                      <strong>{k}</strong>
                    </td>
                    <td>{fmt(r.exit_ebitda)}</td>
                    <td>{fmt(r.exit_ev)}</td>
                    <td>{fmt(r.exit_equity)}</td>
                    {params.entry_ev_m > 0 && (
                      <>
                        <td>{r.entry_equity !== null ? fmt(r.entry_equity) : "—"}</td>
                        <td>{r.moic !== null ? `${fmt(r.moic, 2)}x` : "—"}</td>
                        <td>{r.irr_pct !== null ? `${fmt(r.irr_pct)}%` : "—"}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {SCENARIO_KEYS.map((k) => {
            const r = results.scenarios[k as ScenarioKey];
            return (
              <details key={k} open={k === "base"}>
                <summary>
                  {k} case — year by year ({c}m)
                </summary>
                <table border={1} cellPadding={4}>
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Revenue</th>
                      <th>EBITDA</th>
                      <th>FCF (after interest)</th>
                      <th>Debt</th>
                      <th>Cash</th>
                      <th>Net leverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.rows.map((row) => (
                      <tr key={row.year}>
                        <td>{row.year}</td>
                        <td>{fmt(row.revenue)}</td>
                        <td>{fmt(row.ebitda)}</td>
                        <td>{fmt(row.fcf)}</td>
                        <td>{fmt(row.debt)}</td>
                        <td>{fmt(row.cash)}</td>
                        <td>{row.leverage !== null ? `${fmt(row.leverage, 2)}x` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            );
          })}

          <h4>
            Sensitivity: growth × exit multiple →{" "}
            <button type="button" onClick={() => setShowEquityMatrix(!showEquityMatrix)}>
              showing {showEquityMatrix ? "equity value" : "enterprise value"} (click to switch)
            </button>
          </h4>
          <table border={1} cellPadding={4}>
            <thead>
              <tr>
                <th>growth ↓ / multiple →</th>
                {results.sens.multiples.map((m, j) => (
                  <th key={j}>{fmt(m)}x</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.sens.growths.map((g, i) => (
                <tr key={i}>
                  <td>{fmt(g)}%</td>
                  {results.sens.multiples.map((_, j) => (
                    <td key={j}>{fmt((showEquityMatrix ? results.sens.equity : results.sens.ev)[i][j])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <small>
              {c}m at exit (year {params.base_year + params.horizon_years}), base-case margin; equity = EV minus the
              modelled net debt at exit.
            </small>
          </p>

          <h4>Peer-comp valuation (today, base-case EBITDA of {fmt(results.peers.base_ebitda)} {c}m)</h4>
          <table border={1} cellPadding={4}>
            <thead>
              <tr>
                <th>Peer</th>
                <th>EV/EBITDA</th>
                <th>Implied EV</th>
                <th>Implied equity</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {params.peers.map((peer, i) => {
                const row = results.peers.rows[i];
                return (
                  <tr key={i}>
                    <td>
                      <input
                        value={peer.name}
                        size={20}
                        onChange={(e) =>
                          update((p) => ({
                            ...p,
                            peers: p.peers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                          }))
                        }
                      />
                    </td>
                    <td>
                      <NumInput
                        value={peer.ev_ebitda}
                        step={0.5}
                        width={6}
                        onChange={(v) =>
                          update((p) => ({
                            ...p,
                            peers: p.peers.map((x, j) => (j === i ? { ...x, ev_ebitda: v } : x)),
                          }))
                        }
                      />
                    </td>
                    <td>{row ? fmt(row.ev) : "—"}</td>
                    <td>{row ? fmt(row.equity) : "—"}</td>
                    <td>
                      <input
                        value={peer.note}
                        size={28}
                        onChange={(e) =>
                          update((p) => ({
                            ...p,
                            peers: p.peers.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)),
                          }))
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => update((p) => ({ ...p, peers: p.peers.filter((_, j) => j !== i) }))}
                      >
                        remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p>
            <button
              type="button"
              onClick={() => update((p) => ({ ...p, peers: [...p.peers, { name: "", ev_ebitda: 6, note: "" }] }))}
            >
              + add peer
            </button>{" "}
            {results.peers.median_ev !== null && (
              <small>
                Median implied EV {fmt(results.peers.median_ev)} {c}m · equity {fmt(results.peers.median_equity!)} {c}m.
                Peer multiples are yours to source (listed comps arrive with Phase 4) — small private companies usually
                deserve a discount to listed peers.
              </small>
            )}
          </p>
        </div>
      )}

      <h4>Ask for specific metrics</h4>
      <p>
        <small>
          Name the metrics and ratios you want — computed from the dossier and your current model, with formula, inputs
          and confidence shown. Answers are saved below.
        </small>
      </p>
      <textarea
        value={metricPrompt}
        onChange={(e) => setMetricPrompt(e.target.value)}
        rows={2}
        cols={100}
        placeholder='e.g. "Revenue per employee vs sector, working capital intensity, rule of 40, interest cover in the bear case"'
      />
      <p>
        <button type="button" onClick={runMetricPrompt} disabled={!metricPrompt.trim() || metricStream !== null}>
          {metricStream !== null ? "Computing..." : "Compute metrics"}
        </button>
      </p>
      {metricStream !== null && <pre style={{ whiteSpace: "pre-wrap" }}>{metricStream || "thinking..."}</pre>}
      {metrics.length > 0 && (
        <div>
          {metrics.map((m, i) => (
            <details key={i}>
              <summary>
                {m.prompt} <small>({new Date(m.created_at).toLocaleString()})</small>{" "}
                <button type="button" onClick={() => deleteMetric(i)}>
                  delete
                </button>
              </summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>{m.response}</pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
