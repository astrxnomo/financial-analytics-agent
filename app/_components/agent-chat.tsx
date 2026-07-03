"use client";

import type { Highlights } from "@/agent/lib/finance.types";
import type { EveMessage } from "eve/react";
import { useEveAgent } from "eve/react";
import { AlertCircleIcon, ChartColumnIcon, ChevronRightIcon } from "lucide-react";
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
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { cn } from "@/lib/utils";
import { AgentMessage } from "./agent-message";

const BRAND_NAME = "Financial Analytics";
const BRAND_SUFFIX = "Agent";

// Shown before the /api/finance/highlights fetch resolves, or if it fails —
// generic but always answerable.
const FALLBACK_QUESTIONS = [
  "Show me the revenue trend for the last 6 months.",
  "Which departments are over budget this month?",
  "Any unusual expenses in the last year?",
  "What were total income and expenses this year?",
];

// Index-aligned with the [trend, budget, anomaly, summary] question order
// from buildQuestions.
const QUESTION_TOPICS = ["Revenue", "Budgets", "Anomalies", "P&L"] as const;

const fmtMonthLong = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(iso));

const fmtMonthShort = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(iso));

const fmtMoneyShort = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const fmtToday = () =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

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

function useFinanceHighlights(): {
  readonly highlights: Highlights | undefined;
  readonly questions: readonly string[];
} {
  const [highlights, setHighlights] = useState<Highlights>();
  const [questions, setQuestions] = useState<readonly string[]>(FALLBACK_QUESTIONS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/finance/highlights")
      .then((res) => (res.ok ? (res.json() as Promise<Highlights>) : undefined))
      .then((data) => {
        if (data && !cancelled) {
          setHighlights(data);
          setQuestions(buildQuestions(data));
        }
      })
      .catch(() => {
        // Keep the fallback list — the demo still works without a live DB.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { highlights, questions };
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

// Questions the user already sent (verbatim), so follow-ups never repeat a
// suggestion that was already asked this session.
function sentQuestions(messages: readonly EveMessage[]): ReadonlySet<string> {
  const sent = new Set<string>();
  for (const message of messages) {
    if (message.role !== "user") continue;
    for (const part of message.parts) {
      if (part.type === "text") sent.add(part.text.trim());
    }
  }
  return sent;
}

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
  const { highlights, questions } = useFinanceHighlights();
  const followupTool = isBusy ? undefined : lastFinanceTool(agent.data.messages.at(-1));
  const asked = sentQuestions(agent.data.messages);
  const followups =
    followupTool !== undefined
      ? questions.filter(
          (question, i) => i !== QUESTION_INDEX_BY_TOOL[followupTool] && !asked.has(question),
        )
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
      <PromptInputTextarea placeholder="Query revenue, budgets, or spending…" />
      <PromptInputSubmit onStop={agent.stop} status={agent.status} />
    </PromptInput>
  );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="z-10 mx-auto mt-4 flex h-12 w-[calc(100%-2rem)] max-w-3xl shrink-0 items-center justify-between rounded-2xl border border-border/60 bg-card/60 px-4 shadow-black/20 shadow-lg backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-primary">
            <ChartColumnIcon className="size-3.5" />
          </span>
          <span className="truncate text-sm">
            <span className="font-semibold tracking-tight">{BRAND_NAME}</span>{" "}
            <span className="text-muted-foreground">{BRAND_SUFFIX}</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-muted-foreground text-xs">
          {highlights ? (
            <>
              <span className="hidden tabular-nums sm:inline">
                {fmtMonthShort(highlights.dataFrom)} – {fmtMonthShort(highlights.dataTo)}
              </span>
              <span aria-hidden className="hidden h-3 w-px bg-border sm:inline-block" />
            </>
          ) : null}
          <StatusIndicator status={agent.status} />
        </div>
      </header>

      {agent.error ? (
        <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-3 sm:px-6">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">Request failed</p>
              <p className="mt-0.5 text-muted-foreground">{agent.error.message}</p>
            </div>
          </div>
        </div>
      ) : null}

      {isEmpty ? (
        <EmptyState
          composer={composer}
          highlights={highlights}
          onSuggestionSelect={handleSuggestion}
          questions={questions}
        />
      ) : (
        <>
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
              {agent.status === "submitted" ? (
                <Shimmer as="p" className="text-sm">
                  Analyzing the ledger…
                </Shimmer>
              ) : null}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {followups && followups.length > 0 ? (
            <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-3 sm:px-6">
              <p className="mb-1.5 text-[11px] text-muted-foreground">Continue with</p>
              <Suggestions className="items-center gap-1.5">
                {followups.map((question) => (
                  <Suggestion
                    className="max-w-full border-border/70 bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    key={question}
                    onSuggestionSelect={handleSuggestion}
                    suggestion={question}
                  >
                    <span className="truncate">{question}</span>
                  </Suggestion>
                ))}
              </Suggestions>
            </div>
          ) : null}

          <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4 sm:px-6">{composer}</div>
        </>
      )}
    </main>
  );
}

function EmptyState({
  composer,
  highlights,
  onSuggestionSelect,
  questions,
}: {
  readonly composer: React.ReactNode;
  readonly highlights: Highlights | undefined;
  readonly onSuggestionSelect: (suggestion: string) => void;
  readonly questions: readonly string[];
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center gap-7 px-4 py-10 sm:px-6">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs" suppressHydrationWarning>
            {fmtToday()}
          </p>
          <h1 className="font-semibold text-xl tracking-tight" suppressHydrationWarning>
            {timeGreeting()}
          </h1>
          <p className="text-muted-foreground text-sm">
            Query revenue, budget performance, and spending anomalies across departments.
          </p>
        </div>

        {highlights ? (
          <Briefing
            highlights={highlights}
            onSuggestionSelect={onSuggestionSelect}
            questions={questions}
          />
        ) : null}

        {composer}

        <div>
          <p className="mb-2 text-muted-foreground text-xs">Suggested queries</p>
          <div className="overflow-hidden rounded-xl border border-border/60">
            <ul className="divide-y divide-border/60">
              {questions.map((question, index) => (
                <li key={question}>
                  <button
                    className="group flex w-full items-center gap-4 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/30"
                    onClick={() => onSuggestionSelect(question)}
                    type="button"
                  >
                    <span className="w-20 shrink-0 text-muted-foreground text-xs">
                      {QUESTION_TOPICS[index % QUESTION_TOPICS.length]}
                    </span>
                    <span className="min-w-0 flex-1 text-muted-foreground transition-colors group-hover:text-foreground">
                      {question}
                    </span>
                    <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// At-a-glance ledger facts, each tile wired to the question that expands on
// it. Only rendered once real highlights arrive — no placeholder noise.
function Briefing({
  highlights,
  onSuggestionSelect,
  questions,
}: {
  readonly highlights: Highlights;
  readonly onSuggestionSelect: (suggestion: string) => void;
  readonly questions: readonly string[];
}) {
  const tiles = [
    {
      label: "Reporting period",
      value: `${fmtMonthShort(highlights.dataFrom)} – ${fmtMonthShort(highlights.dataTo)}`,
      detail: `Latest close: ${fmtMonthShort(highlights.latestMonth)}`,
      questionIndex: 3,
    },
    {
      label: "Budget watch",
      value: highlights.mostOverBudgetDept?.department ?? "All within budget",
      detail: highlights.mostOverBudgetDept
        ? `Over budget in ${highlights.mostOverBudgetDept.overMonths} mo`
        : "No department flagged",
      questionIndex: 1,
    },
    {
      label: "Top anomaly",
      value: highlights.topAnomaly
        ? `${fmtMoneyShort(highlights.topAnomaly.amount)} ${highlights.topAnomaly.category}`
        : "None detected",
      detail: highlights.topAnomaly
        ? `${highlights.topAnomaly.department} · ${fmtMonthShort(highlights.topAnomaly.date)}`
        : "Across the full period",
      questionIndex: 2,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {tiles.map((tile) => {
        const question = questions[tile.questionIndex];
        return (
          <button
            className="group rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-card"
            disabled={question === undefined}
            key={tile.label}
            onClick={() => {
              if (question !== undefined) onSuggestionSelect(question);
            }}
            type="button"
          >
            <p className="text-[11px] text-muted-foreground">{tile.label}</p>
            <p className="mt-1 truncate font-medium text-sm tabular-nums">{tile.value}</p>
            <p className="mt-0.5 truncate text-muted-foreground text-xs">{tile.detail}</p>
          </button>
        );
      })}
    </div>
  );
}

const STATUS_LABEL: Partial<Record<AgentStatus, string>> = {
  error: "Error",
  ready: "Connected",
  streaming: "Working",
  submitted: "Working",
};

function StatusIndicator({ status }: { readonly status: AgentStatus }) {
  const isLive = status === "submitted" || status === "streaming";
  const tone =
    status === "error"
      ? "bg-destructive"
      : isLive
        ? "bg-emerald-400"
        : status === "ready"
          ? "bg-emerald-400/70"
          : "bg-muted-foreground/50";

  return (
    <span className="flex shrink-0 items-center gap-2 text-muted-foreground text-xs">
      <span className={cn("inline-flex size-1.5 rounded-full transition-colors", tone)} />
      {STATUS_LABEL[status] ?? "Idle"}
    </span>
  );
}
