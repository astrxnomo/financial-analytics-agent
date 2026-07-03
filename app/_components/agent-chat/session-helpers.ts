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

function stringArrayField(input: unknown, key: string): readonly string[] | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const raw = (input as Record<string, unknown>)[key];
  return Array.isArray(raw) && raw.every((v) => typeof v === "string") ? raw : undefined;
}

function stringField(input: unknown, key: string): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const raw = (input as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw : undefined;
}

// Follow-ups templated on the department(s)/category the last tool call was
// actually scoped to (read from its recorded `input`), so "Continue with"
// keeps pulling the same thread — e.g. after a get_trend comparing two named
// departments, the natural next question is whether either is over budget —
// instead of jumping to an unrelated question from the static pool. Returns
// [] when the last call had no department/category to thread on (get_summary,
// get_cashflow, or an unfiltered company-wide query), so the caller falls
// back to the generic pool.
export function contextualFollowups(message: EveMessage | undefined): readonly string[] {
  if (!message) return [];
  for (let i = message.parts.length - 1; i >= 0; i--) {
    const part = message.parts[i];
    if (part.type !== "dynamic-tool" || part.state !== "output-available") continue;
    const input = part.input;
    switch (part.toolName) {
      case "get_budget_status": {
        const departments = stringArrayField(input, "departments");
        if (departments?.length === 1) {
          const [d] = departments;
          return [
            `What's driving ${d}'s spend?`,
            `Are there any unusual expenses in ${d}?`,
            `How has ${d}'s spending trended over the last year?`,
          ];
        }
        if (departments?.length === 2) {
          const [d1, d2] = departments;
          return [`How does ${d1}'s spending trend compare to ${d2}'s over the full period?`];
        }
        return [];
      }
      case "get_anomalies": {
        const categories = stringArrayField(input, "categories");
        const departments = stringArrayField(input, "departments");
        const out: string[] = [];
        if (categories?.[0]) out.push(`Show me the spending trend for ${categories[0]} over time.`);
        if (departments?.[0]) out.push(`What's ${departments[0]}'s overall budget status?`);
        return out;
      }
      case "get_category_breakdown": {
        const category = stringField(input, "category");
        const department = stringField(input, "department");
        if (category) {
          return [
            `Are there any anomalies in ${category} spending?`,
            `Is the ${category} pattern likely to repeat next year?`,
          ];
        }
        if (department) return [`Are there any unusual expenses in ${department}?`];
        return [];
      }
      case "get_trend": {
        const departments = stringArrayField(input, "departments");
        if (departments?.length === 2) {
          const [d1, d2] = departments;
          return [`Is either ${d1} or ${d2} at risk of going over budget?`];
        }
        if (departments?.length === 1) return [`What's driving ${departments[0]}'s spend mix?`];
        return [];
      }
      default:
        return [];
    }
  }
  return [];
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
