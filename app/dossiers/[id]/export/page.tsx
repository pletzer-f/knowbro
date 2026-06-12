"use client";

// PDF export: configure variant / lens / sections / branding, then
// "Download PDF" opens the browser print dialog (save as PDF). Controls are
// hidden in print; only the document prints.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Dossier, LensConfig, SectionKey } from "@/engine/src/types";
import { resolveView, SECTION_TITLES } from "@/engine/src/lens";
import type { DossierEdits } from "@/lib/edits";
import type { ModelParams } from "@/lib/model";
import ExportView, { type ExportVariant } from "@/components/ExportView";

import investorLens from "@/engine/config/lenses/investor.json";
import entrepreneurLens from "@/engine/config/lenses/entrepreneur.json";
import curiousLens from "@/engine/config/lenses/curious.json";

const LENSES = [investorLens, entrepreneurLens, curiousLens] as LensConfig[];

const ALL_SECTIONS: SectionKey[] = [
  "business_model",
  "ownership_control",
  "financial_picture",
  "capital_structure_health",
  "investment_angle",
  "what_we_dont_know",
];

interface Row {
  id: string;
  company_id: string;
  company_name: string;
  dossier: Dossier;
  overrides: Record<string, string>;
  edits: DossierEdits;
  created_at: string;
}

export default function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [row, setRow] = useState<Row | null>(null);
  const [modelParams, setModelParams] = useState<ModelParams | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [variant, setVariant] = useState<ExportVariant>("short");
  const [lensId, setLensId] = useState("investor");
  const [viewId, setViewId] = useState<string | undefined>(undefined);
  const [sections, setSections] = useState<Set<SectionKey>>(new Set(ALL_SECTIONS));
  const [branding, setBranding] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/dossiers/${id}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error);
        return;
      }
      setRow(json);
      const companyRes = await fetch(`/api/companies/${json.company_id}`);
      if (companyRes.ok) {
        const company = await companyRes.json();
        const p = company.model?.params;
        if (p && Object.keys(p).length > 0) setModelParams(p as ModelParams);
      }
    })();
  }, [id]);

  if (error)
    return (
      <main>
        <p>
          <strong>Error:</strong> {error}
        </p>
      </main>
    );
  if (!row)
    return (
      <main>
        <p>Loading...</p>
      </main>
    );

  const lens = LENSES.find((l) => l.id === lensId) ?? LENSES[0];
  const view = resolveView(lens, viewId);

  return (
    <main>
      {/* print rules: only the document prints; sensible page margins */}
      <style>{`
        @media print {
          nav, .no-print { display: none !important; }
          main { margin: 0; }
        }
        @page { margin: 18mm; }
      `}</style>

      <div className="no-print">
        <p>
          <Link href={`/dossiers/${row.id}`}>← back to dossier</Link>
        </p>
        <h1>Export: {row.company_name}</h1>
        <p>
          Variant:{" "}
          {(
            [
              ["long", "Long — everything incl. all inference paths"],
              ["short", "Short — snapshot + investment angle + open questions"],
              ["visual", "Visual — chart-led, minimal prose (uses the financial model)"],
            ] as [ExportVariant, string][]
          ).map(([v, label]) => (
            <label key={v} style={{ display: "block" }}>
              <input type="radio" name="variant" checked={variant === v} onChange={() => setVariant(v)} /> {label}
            </label>
          ))}
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
              <label key={v.id}>
                <input type="radio" name="view" checked={view.id === v.id} onChange={() => setViewId(v.id)} />
                {v.label}{" "}
              </label>
            ))}
        </p>
        {variant === "long" && (
          <p>
            Sections:{" "}
            {ALL_SECTIONS.map((k) => (
              <label key={k} style={{ marginRight: 12 }}>
                <input
                  type="checkbox"
                  checked={sections.has(k)}
                  onChange={(e) => {
                    const next = new Set(sections);
                    if (e.target.checked) next.add(k);
                    else next.delete(k);
                    setSections(next);
                  }}
                />{" "}
                {SECTION_TITLES[k]}
              </label>
            ))}
          </p>
        )}
        <p>
          <label>
            Branding line (appears at the top, e.g. your firm name){" "}
            <input value={branding} onChange={(e) => setBranding(e.target.value)} size={50} />
          </label>
        </p>
        <p>
          <button type="button" onClick={() => window.print()}>
            Download PDF (opens print dialog — choose "Save as PDF")
          </button>
        </p>
        <hr />
        <p>
          <small>Preview below — exactly this prints.</small>
        </p>
      </div>

      <ExportView
        dossier={row.dossier}
        edits={row.edits ?? {}}
        overrides={row.overrides ?? {}}
        lens={lens}
        view={view}
        variant={variant}
        sections={sections}
        branding={branding}
        modelParams={modelParams}
      />
    </main>
  );
}
