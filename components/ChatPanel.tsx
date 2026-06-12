"use client";

// Company-scoped chat over a dossier. Unstyled, functional.
// - saved dossier (dossierId set): history loads from / persists to the DB
// - fresh result (result set): in-memory; the parent saves the transcript
//   along with the dossier via getTranscript()

import { useEffect, useRef, useState } from "react";
import type { AnalysisResult } from "@/engine/src/types";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPanel({
  dossierId,
  result,
  companyName,
  onTranscriptChange,
}: {
  dossierId?: string;
  result?: AnalysisResult;
  companyName: string;
  onTranscriptChange?: (messages: ChatMsg[]) => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dossierId) return;
    (async () => {
      const res = await fetch(`/api/chat?dossierId=${dossierId}`);
      if (res.ok) {
        const { messages } = await res.json();
        setMessages(messages.map((m: ChatMsg) => ({ role: m.role, content: m.content })));
      }
    })();
  }, [dossierId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
    onTranscriptChange?.(messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const send = async () => {
    const question = input.trim();
    if (!question || busy) return;
    setError(null);
    setInput("");
    setBusy(true);

    const history: ChatMsg[] = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dossierId ? { dossierId, messages: history } : { result, messages: history }),
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        const snapshot = answer;
        setMessages([...history, { role: "assistant", content: snapshot }]);
      }
    } catch (e) {
      setError((e as Error).message);
      setMessages(history); // drop the empty assistant placeholder
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h3>Ask about {companyName}</h3>
      <p>
        <small>
          Same standards as the dossier: confidence-tagged, inference shown, public data only. Tell it things you
          know — it will reason with them and say which estimates they would shift.
        </small>
      </p>
      <div>
        {messages.map((m, i) => (
          <p key={i} style={{ whiteSpace: "pre-wrap" }}>
            <strong>{m.role === "user" ? "You" : "Analyst"}:</strong> {m.content}
            {busy && i === messages.length - 1 && m.role === "assistant" && <em>{m.content ? "" : " thinking..."}</em>}
          </p>
        ))}
        <div ref={bottomRef} />
      </div>
      {error && (
        <p>
          <strong>Error:</strong> {error}
        </p>
      )}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        rows={3}
        cols={100}
        placeholder='e.g. "Why is the margin estimate at the low end?" or "Who would realistically buy this?"'
      />
      <p>
        <button type="button" onClick={send} disabled={busy || !input.trim()}>
          {busy ? "Answering..." : "Send"}
        </button>
      </p>
    </div>
  );
}
