"use client";

// Renders the structured engine output as live, interactive (unstyled) UI:
// - collapsible sections, ordered/emphasised by the selected lens
// - a view switcher per lens (e.g. investor: Espresso / Boardroom / Deep Dive)
//   controlling depth, language and method detail
// - clickable confidence badges revealing the inference path / rationale
// - estimates editable by the user (overrides handled by the parent)
// All presentation decisions come from lens/view config — logic stays in
// engine/src/lens.ts so a later design pass only has to reskin this file.

import { useState, type CSSProperties } from "react";
import type {
  Confidence,
  Critique,
  Dossier,
  Estimate,
  LensConfig,
  LensView,
  SectionCore,
  SectionKey,
} from "@/engine/src/types";
import { applyLens, lensSummary } from "@/engine/src/lens";
import EditableText from "@/components/EditableText";
import type { DossierEdits } from "@/lib/edits";

export type Overrides = Record<string, string>; // estimateId -> overridden value
export type OnEdit = (path: string, value: string | null) => void;

export function ConfidenceBadge({ confidence, label }: { confidence: Confidence; label?: string }) {
  const [open, setOpen] = useState(false);
  const cls =
    confidence.level === "high" ? "kb-conf--high" : confidence.level === "medium" ? "kb-conf--med" : "kb-conf--low";
  return (
    <span>
      <button
        type="button"
        className={`kb-conf ${cls}`}
        onClick={() => setOpen(!open)}
        title="Click to see how confident, and why"
      >
        {label ? `${label} · ` : ""}
        {confidence.level} confidence
      </button>
      {open && (
        <blockquote className="kb-conf-rationale">
          <small>{confidence.rationale}</small>
        </blockquote>
      )}
    </span>
  );
}

/** Basis tag — distinguishes filed fact from inference (a core honesty signal). */
export function BasisTag({ basis }: { basis: string }) {
  const inferred = basis === "estimate" || basis === "inference";
  return <span className={`kb-basis ${inferred ? "kb-basis--estimate" : ""}`}>{basis.replace("_", " ")}</span>;
}

function EstimateView({
  estimate,
  view,
  override,
  onOverride,
}: {
  estimate: Estimate;
  view: LensView;
  override?: string;
  onOverride: (id: string, value: string | null) => void;
}) {
  const [showPath, setShowPath] = useState(view.show_inference_paths_by_default);
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
      <BasisTag basis={estimate.basis} /> <ConfidenceBadge confidence={estimate.confidence} />{" "}
      <button type="button" className="kb-mini" onClick={() => setShowPath(!showPath)}>
        {showPath ? "hide" : "how was this derived?"}
      </button>{" "}
      {!editing ? (
        <button type="button" className="kb-mini" onClick={() => { setDraftValue(effectiveValue); setEditing(true); }}>
          override
        </button>
      ) : (
        <span>
          <input value={draftValue} onChange={(e) => setDraftValue(e.target.value)} size={40} />
          <button type="button" className="kb-mini" onClick={() => { onOverride(estimate.id, draftValue); setEditing(false); }}>
            save
          </button>
          <button type="button" className="kb-mini" onClick={() => setEditing(false)}>cancel</button>
        </span>
      )}
      {showPath && (
        <div>
          <ol>
            {estimate.inference_path.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          {view.show_method_detail && estimate.methods.length > 0 && (
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
  sectionKey,
  section,
  view,
  overrides,
  onOverride,
  edits,
  onEdit,
}: {
  sectionKey: string;
  section: SectionCore;
  view: LensView;
  overrides: Overrides;
  onOverride: (id: string, value: string | null) => void;
  edits: DossierEdits;
  onEdit: OnEdit;
}) {
  const summaryPath = `${sectionKey}.${view.summary_field}`;
  return (
    <div>
      <p>
        <EditableText path={summaryPath} original={lensSummary(section, view)} edits={edits} onEdit={onEdit} />{" "}
        <ConfidenceBadge confidence={section.confidence} />
      </p>
      {view.detail === "full" && section.analysis && (
        <details open={false}>
          <summary>Full analysis</summary>
          <p style={{ whiteSpace: "pre-wrap" }}>{section.analysis}</p>
        </details>
      )}
      {view.detail !== "brief" && section.key_points.length > 0 && (
        <ul>
          {section.key_points.map((k, i) => (
            <li key={i}>
              <EditableText path={`${sectionKey}.key_points.${i}`} original={k} edits={edits} onEdit={onEdit} />
            </li>
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
                view={view}
                override={overrides[e.id]}
                onOverride={onOverride}
              />
            ))}
          </ul>
        </div>
      )}
      {view.detail === "full" && section.sources_and_notes.length > 0 && (
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

function UnknownsSection({
  dossier,
  view,
  expanded,
  title,
}: {
  dossier: Dossier;
  view: LensView;
  expanded: boolean;
  title: string;
}) {
  const s = dossier.what_we_dont_know;
  const [copied, setCopied] = useState(false);

  const copyQuestions = async () => {
    const text = s.items.map((u, i) => `${i + 1}. ${u.diligence_question}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <details open={expanded}>
      <summary>
        <strong>{title}</strong> <small>({s.items.length} gaps → your diligence question list)</small>
      </summary>
      <p>{view.summary_field === "plain_language_summary" ? s.plain_language_summary || s.summary : s.summary}</p>
      <p>
        <button type="button" onClick={copyQuestions}>
          {copied ? "Copied!" : "Copy all questions (to ask the company)"}
        </button>
      </p>
      {view.detail === "brief" ? (
        <ol>
          {s.items.map((u, i) => (
            <li key={i}>
              <em>{u.diligence_question}</em>
            </li>
          ))}
        </ol>
      ) : (
        <table border={1} cellPadding={6}>
          <thead>
            <tr>
              <th>#</th>
              <th>What we don't know</th>
              <th>Why it matters</th>
              <th>Ask this</th>
              <th>How to close the gap</th>
            </tr>
          </thead>
          <tbody>
            {s.items.map((u, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  <strong>{u.gap}</strong>
                </td>
                <td>{u.why_it_matters}</td>
                <td>
                  <em>{u.diligence_question}</em>
                </td>
                <td>
                  <small>{u.how_to_resolve}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
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
  view,
  overrides,
  onOverride,
  edits = {},
  onEdit = () => {},
}: {
  dossier: Dossier;
  lens: LensConfig;
  view: LensView;
  overrides: Overrides;
  onOverride: (id: string, value: string | null) => void;
  edits?: DossierEdits;
  onEdit?: OnEdit;
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
            <table>
              <tbody>
                {s.key_numbers.map((n, i) => (
                  <tr key={i}>
                    <td>{n.label}</td>
                    <td className="kb-num">{n.value}</td>
                    <td>
                      <BasisTag basis={n.basis} />
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
      return <UnknownsSection key={key} dossier={dossier} view={view} expanded={expanded} title={title} />;
    }

    const section = dossier[key];
    return (
      <details open={expanded} key={key}>
        <summary>
          <strong>{title}</strong>
        </summary>
        <SectionBody
          sectionKey={key}
          section={section}
          view={view}
          overrides={overrides}
          onOverride={onOverride}
          edits={edits}
          onEdit={onEdit}
        />
        {/* Section-spanning conclusions live in dossier.conclusions (kept out of
            the sections in the schema for grammar-size reasons) but render in
            their home sections here. */}
        {key === "ownership_control" && (
          <p>
            <strong>Owner motivation read:</strong>{" "}
            <EditableText
              path="conclusions.owner_motivation_read"
              original={dossier.conclusions.owner_motivation_read}
              edits={edits}
              onEdit={onEdit}
            />
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
              <strong>Investment thesis:</strong>{" "}
              <EditableText
                path="conclusions.investment_thesis"
                original={dossier.conclusions.investment_thesis}
                edits={edits}
                onEdit={onEdit}
              />
            </p>
            {view.detail !== "brief" && (
              <>
                <p>
                  <strong>Moat:</strong>{" "}
                  <EditableText
                    path="conclusions.moat_assessment"
                    original={dossier.conclusions.moat_assessment}
                    edits={edits}
                    onEdit={onEdit}
                  />
                </p>
                <p>
                  <strong>Exit thesis:</strong>{" "}
                  <EditableText
                    path="conclusions.exit_thesis"
                    original={dossier.conclusions.exit_thesis}
                    edits={edits}
                    onEdit={onEdit}
                  />
                </p>
              </>
            )}
            <p>
              <strong>Deal-killers:</strong>
            </p>
            <ol>
              {dossier.conclusions.deal_killers.map((k, i) => (
                <li key={i}>
                  <strong>
                    <EditableText
                      path={`conclusions.deal_killers.${i}.title`}
                      original={k.title}
                      edits={edits}
                      onEdit={onEdit}
                      multiline={false}
                    />
                  </strong>{" "}
                  <small>[{k.severity.replace(/_/g, " ")}]</small> —{" "}
                  <EditableText
                    path={`conclusions.deal_killers.${i}.rationale`}
                    original={k.rationale}
                    edits={edits}
                    onEdit={onEdit}
                  />
                </li>
              ))}
            </ol>
            <p>
              <strong>Verdict:</strong>{" "}
              <EditableText
                path="conclusions.verdict"
                original={dossier.conclusions.verdict}
                edits={edits}
                onEdit={onEdit}
              />
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
          {dossier.data_period_note} — lens: {lens.label} / {view.label} ({view.tagline})
        </small>
      </p>
      <div className="kb-stagger">
        {lensed.sections.map((s, i) => (
          <div key={s.key} style={{ "--kb-i": i } as CSSProperties}>
            {renderSection(s.key, s.expandedByDefault, s.title)}
          </div>
        ))}
      </div>
    </div>
  );
}
