"use client";

import type { Highlights } from "@/agent/lib/finance.types";
import type { EveMessage } from "eve/react";
import { useEveAgent } from "eve/react";
import { AlertCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { cn } from "@/lib/utils";
import { AgentMessage } from "./agent-message";

const AGENT_NAME = "financial-analytics-agent";

// Shown before the /api/finance/highlights fetch resolves, or if it fails —
// generic but always answerable.
const FALLBACK_QUESTIONS = [
  "Show me the revenue trend for the last 6 months.",
  "Which departments are over budget this month?",
  "Any unusual expenses in the last year?",
  "What were total income and expenses this year?",
];

const fmtMonthLong = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(iso));

const fmtMoneyShort = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

// Deterministic questions grounded in the real seeded data (date coverage,
// the biggest detected anomaly, the department that's over budget most
// often) — no extra model round-trip, so there's no risk of the model
// looping on a "suggest more" instruction.
function buildQuestions(h: Highlights): readonly string[] {
  const trend = `Show me the revenue trend from ${fmtMonthLong(h.dataFrom)} to ${fmtMonthLong(h.dataTo)}.`;
  const budget = h.mostOverBudgetDept
    ? `Why does ${h.mostOverBudgetDept.department} keep going over budget?`
    : `Which departments are over budget in ${fmtMonthLong(h.latestMonth)}?`;
  const anomaly = h.topAnomaly
    ? `Why was there a ${fmtMoneyShort(h.topAnomaly.amount)} ${h.topAnomaly.category} spike in ${h.topAnomaly.department}?`
    : `Any unusual expenses from ${fmtMonthLong(h.dataFrom)} to ${fmtMonthLong(h.dataTo)}?`;
  const summary = `What were total income and expenses from ${fmtMonthLong(h.dataFrom)} to ${fmtMonthLong(h.dataTo)}?`;
  return [trend, budget, anomaly, summary];
}

function useFinanceQuestions(): readonly string[] {
  const [questions, setQuestions] = useState<readonly string[]>(FALLBACK_QUESTIONS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/finance/highlights")
      .then((res) => (res.ok ? (res.json() as Promise<Highlights>) : undefined))
      .then((highlights) => {
        if (highlights && !cancelled) setQuestions(buildQuestions(highlights));
      })
      .catch(() => {
        // Keep the fallback list — the demo still works without a live DB.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return questions;
}

// [trend, budget, anomaly, summary] — index of the question a given tool
// answers, so follow-ups can offer the other three.
const QUESTION_INDEX_BY_TOOL: Record<string, number> = {
  get_anomalies: 2,
  get_budget_status: 1,
  get_summary: 3,
  get_trend: 0,
};

type AgentStatus = ReturnType<typeof useEveAgent>["status"];

function lastFinanceTool(message: EveMessage | undefined): string | undefined {
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

export function AgentChat() {
  const agent = useEveAgent();
  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isEmpty = agent.data.messages.length === 0;
  const questions = useFinanceQuestions();
  const followupTool = isBusy ? undefined : lastFinanceTool(agent.data.messages.at(-1));
  const followups =
    followupTool !== undefined
      ? questions.filter((_, i) => i !== QUESTION_INDEX_BY_TOOL[followupTool])
      : undefined;

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || isBusy) return;

    await agent.send({ message: text });
  };

  const handleSuggestion = (suggestion: string) => {
    if (isBusy) return;
    void agent.send({ message: suggestion });
  };

  const composer = (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea placeholder="Send a message…" />
      <PromptInputSubmit onStop={agent.stop} status={agent.status} />
    </PromptInput>
  );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {isEmpty ? null : (
        <header className="flex h-14 shrink-0 items-center justify-center gap-3 pl-4 pr-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-muted-foreground text-sm">{AGENT_NAME}</span>
            <StatusDot status={agent.status} />
          </span>
        </header>
      )}

      {agent.error ? (
        <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-2 sm:px-6">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">Request failed</p>
              <p className="mt-0.5 text-muted-foreground">{agent.error.message}</p>
            </div>
          </div>
        </div>
      ) : null}

      {isEmpty ? null : (
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 sm:px-6">
            {agent.data.messages.map((message, index) => (
              <AgentMessage
                canRespond={!isBusy}
                isStreaming={
                  agent.status === "streaming" && index === agent.data.messages.length - 1
                }
                key={message.id}
                message={message}
                onInputResponses={(inputResponses) => agent.send({ inputResponses })}
              />
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      {followups && !isEmpty ? (
        <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-3 sm:px-6">
          <Suggestions>
            {followups.map((question) => (
              <Suggestion key={question} onSuggestionSelect={handleSuggestion} suggestion={question} />
            ))}
          </Suggestions>
        </div>
      ) : null}

      <div
        className={cn(
          "mx-auto w-full px-4 sm:px-6",
          isEmpty
            ? "flex max-w-xl flex-1 flex-col items-center justify-center gap-8 pb-[10vh]"
            : "max-w-3xl shrink-0 pb-6",
        )}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="font-medium text-5xl tracking-tighter">{AGENT_NAME}</h1>
          </div>
        ) : null}
        <div className="w-full">{composer}</div>
        {isEmpty ? (
          <Suggestions className="justify-center">
            {questions.map((question) => (
              <Suggestion key={question} onSuggestionSelect={handleSuggestion} suggestion={question} />
            ))}
          </Suggestions>
        ) : null}
      </div>
    </main>
  );
}

function StatusDot({ status }: { readonly status: AgentStatus }) {
  const isLive = status === "submitted" || status === "streaming";
  const tone =
    status === "error"
      ? "bg-destructive"
      : isLive
        ? "bg-emerald-500"
        : status === "ready"
          ? "bg-muted-foreground"
          : "bg-muted-foreground/50";

  return (
    <span className="relative flex size-1">
      {isLive ? (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-75",
            tone,
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex size-1 rounded-full transition-colors", tone)} />
    </span>
  );
}
