"use client";

// Renders the structured engine output as live, interactive (unstyled) UI:
// - collapsible sections, ordered/emphasised by the selected lens
// - clickable confidence badges revealing the inference path / rationale
// - estimates editable by the user (overrides handled by the parent)
// All presentation decisions come from the lens config — logic stays in
// engine/src/lens.ts so a later design pass only has to reskin this file.

import { useState } from "react";
import type { Confidence, Critique, Dossier, Estimate, LensConfig, SectionCore, SectionKey } from "@/engine/src/types";
import { applyLens, lensSummary } from "@/engine/src/lens";

export type Overrides = Record<string, string>; // estimateId -> overridden value

export function ConfidenceBadge({ confidence, label }: { confidence: Confidence; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span>
      <button type="button" onClick={() => setOpen(!open)} title="Click to see why">
        [{label ? `${label}: ` : ""}confidence: {confidence.level}]
      </button>
      {open && (
        <blockquote>
          <small>{confidence.rationale}</small>
        </blockquote>
      )}
    </span>
  );
}

function EstimateView({
  estimate,
  showMethodDetail,
  showPathByDefault,
  override,
  onOverride,
}: {
  estimate: Estimate;
  showMethodDetail: boolean;
  showPathByDefault: boolean;
  override?: string;
  onOverride: (id: string, value: string | null) => void;
}) {
  const [showPath, setShowPath] = useState(showPathByDefault);
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(override ?? estimate.value);

  const effectiveValue = override ?? estimate.value;

  return (
    <li>
      <strong>{estimate.label}:</strong> {effectiveValue}{" "}
      {override !== undefined && (
        <em>
          (your override — engine said: {estimate.value}){" "}
          <button type="button" onClick={() => onOverride(estimate.id, null)}>
            reset
          </button>
        </em>
      )}{" "}
      <small>[{estimate.basis.replace("_", " ")}]</small> <ConfidenceBadge confidence={estimate.confidence} />{" "}
      <button type="button" onClick={() => setShowPath(!showPath)}>
        {showPath ? "hide" : "show"} inference path
      </button>{" "}
      {!editing ? (
        <button type="button" onClick={() => { setDraftValue(effectiveValue); setEditing(true); }}>
          override value
        </button>
      ) : (
        <span>
          <input value={draftValue} onChange={(e) => setDraftValue(e.target.value)} size={40} />
          <button type="button" onClick={() => { onOverride(estimate.id, draftValue); setEditing(false); }}>
            save
          </button>
          <button type="button" onClick={() => setEditing(false)}>cancel</button>
        </span>
      )}
      {showPath && (
        <div>
          <ol>
            {estimate.inference_path.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          {showMethodDetail && estimate.methods.length > 0 && (
            <details>
              <summary>Methods ({estimate.methods.length}) &amp; reconciliation</summary>
              <ul>
                {estimate.methods.map((m, i) => (
                  <li key={i}>
                    {/* "Method: x | Inputs: ... | Logic: ... | Result: ..." — split for readability */}
                    {m.split(" | ").map((part, j) => (
                      <div key={j}>
                        <small>{part}</small>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
              {estimate.reconciliation && <p><em>Reconciliation:</em> {estimate.reconciliation}</p>}
            </details>
          )}
          {estimate.cross_checks.length > 0 && (
            <p>
              <small>Cross-checks: {estimate.cross_checks.join(" · ")}</small>
            </p>
          )}
          {estimate.what_would_raise_confidence.length > 0 && (
            <p>
              <small>Would raise confidence: {estimate.what_would_raise_confidence.join(" · ")}</small>
            </p>
          )}
          {estimate.caveats.length > 0 && (
            <p>
              <small>Caveats: {estimate.caveats.join(" · ")}</small>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function SectionBody({
  section,
  lens,
  overrides,
  onOverride,
}: {
  section: SectionCore;
  lens: LensConfig;
  overrides: Overrides;
  onOverride: (id: string, value: string | null) => void;
}) {
  return (
    <div>
      <p>
        {lensSummary(section, lens)} <ConfidenceBadge confidence={section.confidence} />
      </p>
      {lens.depth === "full" && section.analysis && (
        <details open={false}>
          <summary>Full analysis</summary>
          <p style={{ whiteSpace: "pre-wrap" }}>{section.analysis}</p>
        </details>
      )}
      {section.key_points.length > 0 && (
        <ul>
          {section.key_points.map((k, i) => (
            <li key={i}>{k}</li>
          ))}
        </ul>
      )}
      {section.estimates.length > 0 && (
        <div>
          <em>Estimates:</em>
          <ul>
            {section.estimates.map((e) => (
              <EstimateView
                key={e.id}
                estimate={e}
                showMethodDetail={lens.show_method_detail}
                showPathByDefault={lens.show_inference_paths_by_default}
                override={overrides[e.id]}
                onOverride={onOverride}
              />
            ))}
          </ul>
        </div>
      )}
      {lens.depth === "full" && section.sources_and_notes.length > 0 && (
        <details>
          <summary>Sources &amp; notes</summary>
          <ul>
            {section.sources_and_notes.map((s, i) => (
              <li key={i}>
                <small>{s}</small>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function CritiquePanel({ critique }: { critique: Critique }) {
  return (
    <details>
      <summary>
        Self-critique (red-team pass) — {critique.findings.length} finding{critique.findings.length === 1 ? "" : "s"}
      </summary>
      <p>
        <em>{critique.overall_assessment}</em>
      </p>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Section</th>
            <th>Issue</th>
            <th>Detail</th>
            <th>Fix applied / recommended</th>
          </tr>
        </thead>
        <tbody>
          {critique.findings.map((f) => (
            <tr key={f.id}>
              <td>{f.severity}</td>
              <td>
                {f.target_section}
                {f.target_estimate_id ? ` / ${f.target_estimate_id}` : ""}
              </td>
              <td>{f.issue_type.replace(/_/g, " ")}</td>
              <td>{f.detail}</td>
              <td>{f.recommended_fix}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export default function DossierView({
  dossier,
  lens,
  overrides,
  onOverride,
}: {
  dossier: Dossier;
  lens: LensConfig;
  overrides: Overrides;
  onOverride: (id: string, value: string | null) => void;
}) {
  const lensed = applyLens(dossier, lens);

  const renderSection = (key: SectionKey, expanded: boolean, title: string) => {
    if (key === "snapshot") {
      const s = dossier.snapshot;
      return (
        <details open={expanded} key={key}>
          <summary>
            <strong>{title}</strong> <ConfidenceBadge confidence={s.overall_confidence} label="overall" />
          </summary>
          <p>
            <strong>{s.one_liner}</strong>
          </p>
          <p>{s.headline_view}</p>
          {s.key_numbers.length > 0 && (
            <table border={1} cellPadding={4}>
              <tbody>
                {s.key_numbers.map((n, i) => (
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
        </details>
      );
    }

    if (key === "what_we_dont_know") {
      const s = dossier.what_we_dont_know;
      return (
        <details open={expanded} key={key}>
          <summary>
            <strong>{title}</strong>
          </summary>
          <p>{lens.summary_field === "plain_language_summary" ? s.plain_language_summary || s.summary : s.summary}</p>
          <ol>
            {s.items.map((u, i) => (
              <li key={i}>
                <strong>{u.gap}</strong>
                <br />
                Why it matters: {u.why_it_matters}
                <br />
                Ask: <em>{u.diligence_question}</em>
                <br />
                <small>How to resolve: {u.how_to_resolve}</small>
              </li>
            ))}
          </ol>
        </details>
      );
    }

    const section = dossier[key];
    return (
      <details open={expanded} key={key}>
        <summary>
          <strong>{title}</strong>
        </summary>
        <SectionBody section={section} lens={lens} overrides={overrides} onOverride={onOverride} />
        {/* Section-spanning conclusions live in dossier.conclusions (kept out of
            the sections in the schema for grammar-size reasons) but render in
            their home sections here. */}
        {key === "ownership_control" && (
          <p>
            <strong>Owner motivation read:</strong> {dossier.conclusions.owner_motivation_read}
          </p>
        )}
        {key === "capital_structure_health" && (
          <p>
            <strong>Health verdict:</strong> {dossier.conclusions.health_verdict.replace(/_/g, " ")}
          </p>
        )}
        {key === "investment_angle" && (
          <div>
            <p>
              <strong>Moat:</strong> {dossier.conclusions.moat_assessment}
            </p>
            <p>
              <strong>Exit thesis:</strong> {dossier.conclusions.exit_thesis}
            </p>
            <p>
              <strong>Deal-killers:</strong>
            </p>
            <ol>
              {dossier.conclusions.deal_killers.map((k, i) => (
                <li key={i}>
                  <strong>{k.title}</strong> <small>[{k.severity.replace(/_/g, " ")}]</small> — {k.rationale}
                </li>
              ))}
            </ol>
            <p>
              <strong>Verdict:</strong> {dossier.conclusions.verdict}
            </p>
          </div>
        )}
      </details>
    );
  };

  return (
    <div>
      <h2>{dossier.company_name}</h2>
      <p>
        <small>
          {dossier.data_period_note} — lens: {lens.label} ({lens.intro_note})
        </small>
      </p>
      {lensed.sections.map((s) => renderSection(s.key, s.expandedByDefault, s.title))}
    </div>
  );
}
