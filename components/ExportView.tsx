"use client";

// Print/PDF renderer for a dossier. Three variants per the spec:
//   long   — everything incl. all inference paths
//   short  — snapshot + investment angle + the unknowns (diligence questions)
//   visual — chart-led, minimal prose (uses the company's financial model)
// User edits and estimate overrides are applied (this is *their* dossier).
// Printing happens via the browser (Download PDF = print dialog -> save as PDF).

import type { Dossier, Estimate, LensConfig, LensView, SectionKey } from "@/engine/src/types";
import { SECTION_TITLES } from "@/engine/src/lens";
import { effectiveText, type DossierEdits } from "@/lib/edits";
import { runScenario, sensitivity, SCENARIO_KEYS, type ModelParams, type ScenarioKey } from "@/lib/model";

export type ExportVariant = "long" | "short" | "visual";

const fmt = (n: number, d = 1) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

function EstimateLine({
  e,
  overrides,
  full,
}: {
  e: Estimate;
  overrides: Record<string, string>;
  full: boolean;
}) {
  const value = overrides[e.id] ?? e.value;
  return (
    <li>
      <strong>{e.label}:</strong> {value}
      {overrides[e.id] !== undefined && <em> (user override; engine: {e.value})</em>}{" "}
      <small>
        [{e.basis.replace("_", " ")} · confidence {e.confidence.level}]
      </small>
      {full && (
        <div>
          <small>
            <em>Why:</em> {e.confidence.rationale}
          </small>
          <ol>
            {e.inference_path.map((s, i) => (
              <li key={i}>
                <small>{s}</small>
              </li>
            ))}
          </ol>
          {e.methods.length > 0 && (
            <p>
              <small>
                <em>Methods:</em> {e.methods.join(" · ")}
                {e.reconciliation ? ` — Reconciliation: ${e.reconciliation}` : ""}
              </small>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function ConclusionsBlock({ dossier, edits }: { dossier: Dossier; edits: DossierEdits }) {
  const c = dossier.conclusions;
  return (
    <div>
      <p>
        <strong>Investment thesis:</strong> {effectiveText(edits, "conclusions.investment_thesis", c.investment_thesis)}
      </p>
      <p>
        <strong>Owner motivation:</strong>{" "}
        {effectiveText(edits, "conclusions.owner_motivation_read", c.owner_motivation_read)}
      </p>
      <p>
        <strong>Moat:</strong> {effectiveText(edits, "conclusions.moat_assessment", c.moat_assessment)}
      </p>
      <p>
        <strong>Exit thesis:</strong> {effectiveText(edits, "conclusions.exit_thesis", c.exit_thesis)}
      </p>
      <p>
        <strong>Deal-killers:</strong>
      </p>
      <ol>
        {c.deal_killers.map((k, i) => (
          <li key={i}>
            <strong>{effectiveText(edits, `conclusions.deal_killers.${i}.title`, k.title)}</strong>{" "}
            <small>[{k.severity.replace(/_/g, " ")}]</small> —{" "}
            {effectiveText(edits, `conclusions.deal_killers.${i}.rationale`, k.rationale)}
          </li>
        ))}
      </ol>
      <p>
        <strong>Verdict:</strong> {effectiveText(edits, "conclusions.verdict", c.verdict)}
      </p>
    </div>
  );
}

function UnknownsBlock({ dossier }: { dossier: Dossier }) {
  return (
    <div>
      <h2>{SECTION_TITLES.what_we_dont_know}</h2>
      <p>{dossier.what_we_dont_know.summary}</p>
      <ol>
        {dossier.what_we_dont_know.items.map((u, i) => (
          <li key={i}>
            <strong>{u.gap}</strong> — {u.why_it_matters}
            <br />
            <em>Ask: {u.diligence_question}</em>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Simple grouped bar chart (revenue + EBITDA per year) — plain SVG, no library. */
function ProjectionChart({ params }: { params: ModelParams }) {
  const r = runScenario(params, params.scenarios.base);
  const w = 640;
  const h = 240;
  const pad = 36;
  const maxV = Math.max(...r.rows.map((row) => row.revenue)) * 1.1 || 1;
  const bw = (w - pad * 2) / r.rows.length;
  return (
    <svg width={w} height={h + 24} role="img" aria-label="Base-case projection">
      {r.rows.map((row, i) => {
        const x = pad + i * bw;
        const revH = (row.revenue / maxV) * h;
        const ebH = (row.ebitda / maxV) * h;
        return (
          <g key={row.year}>
            <rect x={x + 4} y={h - revH} width={bw * 0.38} height={revH} fill="#888" />
            <rect x={x + 4 + bw * 0.42} y={h - ebH} width={bw * 0.38} height={ebH} fill="#333" />
            <text x={x + bw / 2} y={h + 14} fontSize={10} textAnchor="middle">
              {row.year}
            </text>
            <text x={x + bw / 2} y={h - revH - 4} fontSize={9} textAnchor="middle">
              {fmt(row.revenue, 0)}
            </text>
          </g>
        );
      })}
      <text x={pad} y={12} fontSize={10}>
        Base case ({params.currency}m): revenue (grey) and EBITDA (dark), growth{" "}
        {params.scenarios.base.growth_pct}% p.a., margin {params.scenarios.base.ebitda_margin_pct}%
      </text>
    </svg>
  );
}

function ModelTables({ params }: { params: ModelParams }) {
  const sens = sensitivity(params);
  return (
    <div>
      <h3>Scenario outcomes ({params.currency}m)</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th></th>
            <th>Exit EBITDA</th>
            <th>Exit EV</th>
            <th>Exit equity</th>
            {params.entry_ev_m > 0 && (
              <>
                <th>MoIC</th>
                <th>IRR</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {SCENARIO_KEYS.map((k) => {
            const r = runScenario(params, params.scenarios[k as ScenarioKey]);
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
                    <td>{r.moic !== null ? `${fmt(r.moic, 2)}x` : "—"}</td>
                    <td>{r.irr_pct !== null ? `${fmt(r.irr_pct)}%` : "—"}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3>Exit EV sensitivity: growth × multiple ({params.currency}m)</h3>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>growth ↓ / ×</th>
            {sens.multiples.map((m, j) => (
              <th key={j}>{fmt(m)}x</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sens.growths.map((g, i) => (
            <tr key={i}>
              <td>{fmt(g)}%</td>
              {sens.multiples.map((_, j) => (
                <td key={j}>{fmt(sens.ev[i][j], 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ExportView({
  dossier,
  edits,
  overrides,
  lens,
  view,
  variant,
  sections,
  branding,
  modelParams,
}: {
  dossier: Dossier;
  edits: DossierEdits;
  overrides: Record<string, string>;
  lens: LensConfig;
  view: LensView;
  variant: ExportVariant;
  sections: Set<SectionKey>;
  branding: string;
  modelParams: ModelParams | null;
}) {
  const today = new Date().toLocaleDateString();
  const header = (
    <div>
      {branding && (
        <p>
          <strong>{branding}</strong>
        </p>
      )}
      <h1>{dossier.company_name}</h1>
      <p>
        <small>
          {variant === "long" ? "Full dossier" : variant === "short" ? "Summary dossier" : "Visual dossier"} ·{" "}
          {lens.label} lens · {today} · {dossier.data_period_note}
        </small>
      </p>
      <p>
        <strong>{dossier.snapshot.one_liner}</strong>{" "}
        <small>[overall confidence: {dossier.snapshot.overall_confidence.level}]</small>
      </p>
      <p>{dossier.snapshot.headline_view}</p>
      {dossier.snapshot.key_numbers.length > 0 && (
        <table border={1} cellPadding={4}>
          <tbody>
            {dossier.snapshot.key_numbers.map((n, i) => (
              <tr key={i}>
                <td>{n.label}</td>
                <td>{n.value}</td>
                <td>
                  <small>{n.basis.replace("_", " ")}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  if (variant === "visual") {
    return (
      <div>
        {header}
        {modelParams && modelParams.base_revenue_m > 0 ? (
          <div>
            <ProjectionChart params={modelParams} />
            <ModelTables params={modelParams} />
          </div>
        ) : (
          <p>
            <em>No financial model set up for this company yet — charts need it. (Company page → Financial model.)</em>
          </p>
        )}
        <h2>Deal-killers & verdict</h2>
        <ol>
          {dossier.conclusions.deal_killers.map((k, i) => (
            <li key={i}>
              <strong>{effectiveText(edits, `conclusions.deal_killers.${i}.title`, k.title)}</strong>{" "}
              <small>[{k.severity.replace(/_/g, " ")}]</small>
            </li>
          ))}
        </ol>
        <p>
          <strong>Verdict:</strong> {effectiveText(edits, "conclusions.verdict", dossier.conclusions.verdict)}
        </p>
        <p>
          <em>Top diligence questions:</em>
        </p>
        <ol>
          {dossier.what_we_dont_know.items.slice(0, 5).map((u, i) => (
            <li key={i}>
              <small>{u.diligence_question}</small>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (variant === "short") {
    return (
      <div>
        {header}
        <h2>{SECTION_TITLES.investment_angle}</h2>
        <p>{effectiveText(edits, `investment_angle.${view.summary_field}`, dossier.investment_angle[view.summary_field])}</p>
        <ConclusionsBlock dossier={dossier} edits={edits} />
        <div style={{ pageBreakBefore: "always" }}>
          <UnknownsBlock dossier={dossier} />
        </div>
      </div>
    );
  }

  // long
  const analyticalKeys: SectionKey[] = lens.section_order.filter(
    (k) => k !== "snapshot" && k !== "what_we_dont_know"
  );
  return (
    <div>
      {header}
      {analyticalKeys
        .filter((k) => sections.has(k))
        .map((key) => {
          const section = dossier[key as Exclude<SectionKey, "snapshot" | "what_we_dont_know">];
          return (
            <div key={key} style={{ pageBreakBefore: "always" }}>
              <h2>{SECTION_TITLES[key]}</h2>
              <p>
                {effectiveText(edits, `${key}.${view.summary_field}`, section[view.summary_field])}{" "}
                <small>[confidence: {section.confidence.level}]</small>
              </p>
              {section.key_points.length > 0 && (
                <ul>
                  {section.key_points.map((kp, i) => (
                    <li key={i}>{effectiveText(edits, `${key}.key_points.${i}`, kp)}</li>
                  ))}
                </ul>
              )}
              {section.analysis && <p style={{ whiteSpace: "pre-wrap" }}>{section.analysis}</p>}
              {section.estimates.length > 0 && (
                <ul>
                  {section.estimates.map((e) => (
                    <EstimateLine key={e.id} e={e} overrides={overrides} full />
                  ))}
                </ul>
              )}
              {key === "investment_angle" && <ConclusionsBlock dossier={dossier} edits={edits} />}
              {key === "ownership_control" && (
                <p>
                  <strong>Owner motivation:</strong>{" "}
                  {effectiveText(edits, "conclusions.owner_motivation_read", dossier.conclusions.owner_motivation_read)}
                </p>
              )}
            </div>
          );
        })}
      {sections.has("what_we_dont_know") && (
        <div style={{ pageBreakBefore: "always" }}>
          <UnknownsBlock dossier={dossier} />
        </div>
      )}
    </div>
  );
}
