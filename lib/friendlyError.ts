// Turn raw API/engine error strings into one human sentence. The Anthropic
// API occasionally returns transient errors (overload, rate limit) as JSON;
// users should see plain, actionable language — and know what's retryable.

export function friendlyError(raw: string): string {
  const s = (raw || "").toLowerCase();
  if (s.includes("overloaded")) {
    return "Anthropic’s API was momentarily overloaded. This is temporary — try again in a moment.";
  }
  if (s.includes("rate_limit") || s.includes("429")) {
    return "Hit the API rate limit. Wait a few seconds and try again.";
  }
  if (s.includes("usage limit") || s.includes("regain access")) {
    return "The monthly API usage limit has been reached — raise it in the Anthropic console to continue.";
  }
  if (s.includes("not authenticated") || s.includes("401")) {
    return "Your session expired — please sign in again.";
  }
  if (s.includes("max_tokens") || s.includes("truncat")) {
    return "The model hit its output limit mid-result. Try again.";
  }
  // Already-human messages (our own thrown errors) pass through unchanged.
  if (raw && !raw.trim().startsWith("{") && raw.length < 200) return raw;
  return "Something went wrong running this. It’s usually transient — try again.";
}
