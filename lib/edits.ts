// In-dossier text edits. The engine's original text is never destroyed: edits
// are an overlay keyed by field path ("conclusions.verdict",
// "business_model.key_points.2", ...), each with a timestamp, revertable.

export interface DossierEdit {
  value: string;
  edited_at: string; // ISO
}

export type DossierEdits = Record<string, DossierEdit>;

export function effectiveText(edits: DossierEdits, path: string, original: string): string {
  return edits[path]?.value ?? original;
}

export function withEdit(edits: DossierEdits, path: string, value: string | null): DossierEdits {
  const next = { ...edits };
  if (value === null) delete next[path];
  else next[path] = { value, edited_at: new Date().toISOString() };
  return next;
}
