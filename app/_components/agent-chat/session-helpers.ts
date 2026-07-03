import type { EveMessage } from "eve/react";

// Maps a tool name to the one suggested-question index it primarily answers,
// so follow-ups can exclude that question and offer the others instead. Two
// questions (breakdown, growth) both resolve via get_category_breakdown; only
// one index fits per tool key here, so the follow-up filter only ever
// suppresses "breakdown" after that tool runs — "growth" may still be offered
// even right after a breakdown answer, which is harmless (it's a different
// question about the same data).
export const QUESTION_INDEX_BY_TOOL: Record<string, number> = {
  get_anomalies: 2,
  get_budget_status: 1,
  get_cashflow: 4,
  get_category_breakdown: 5,
  get_summary: 3,
  get_trend: 0,
};

// Questions the user already sent (verbatim), so follow-ups never repeat a
// suggestion that was already asked this session.
export function sentQuestions(messages: readonly EveMessage[]): ReadonlySet<string> {
  const sent = new Set<string>();
  for (const message of messages) {
    if (message.role !== "user") continue;
    for (const part of message.parts) {
      if (part.type === "text") sent.add(part.text.trim());
    }
  }
  return sent;
}

export function lastFinanceTool(message: EveMessage | undefined): string | undefined {
  if (!message) return undefined;
  for (let i = message.parts.length - 1; i >= 0; i--) {
    const part = message.parts[i];
    if (
      part.type === "dynamic-tool" &&
      part.state === "output-available" &&
      part.toolName in QUESTION_INDEX_BY_TOOL
    ) {
      return part.toolName;
    }
  }
  return undefined;
}

// The text of the most recently sent user turn, so a failed request can be
// retried without the user retyping it — eve keeps the user message in
// history even when the assistant's turn errors out.
export function lastUserText(messages: readonly EveMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role !== "user") continue;
    const text = message.parts.find((part) => part.type === "text")?.text;
    if (text) return text;
  }
  return undefined;
}
