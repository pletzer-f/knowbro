"use client";

// Inline-editable text with the engine's original preserved: edited fields
// show a marker + timestamp and can be reverted with one click.

import { useState } from "react";
import type { DossierEdits } from "@/lib/edits";

export default function EditableText({
  path,
  original,
  edits,
  onEdit,
  multiline = true,
}: {
  path: string;
  original: string;
  edits: DossierEdits;
  onEdit: (path: string, value: string | null) => void;
  multiline?: boolean;
}) {
  const edit = edits[path];
  const value = edit?.value ?? original;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <span>
        {multiline ? (
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} cols={90} />
        ) : (
          <input value={draft} onChange={(e) => setDraft(e.target.value)} size={70} />
        )}{" "}
        <button
          type="button"
          onClick={() => {
            // Saving text identical to the original clears the edit.
            onEdit(path, draft === original ? null : draft);
            setEditing(false);
          }}
        >
          save
        </button>{" "}
        <button type="button" onClick={() => setEditing(false)}>
          cancel
        </button>
      </span>
    );
  }

  return (
    <span>
      {value}{" "}
      <button
        type="button"
        title="Edit this text (the engine's original is kept)"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        ✎
      </button>
      {edit && (
        <small>
          {" "}
          (edited {new Date(edit.edited_at).toLocaleDateString()}{" "}
          <button type="button" title={`Engine original: ${original}`} onClick={() => onEdit(path, null)}>
            revert
          </button>
          )
        </small>
      )}
    </span>
  );
}
