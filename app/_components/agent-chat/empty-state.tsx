"use client";

import type { Highlights } from "@/agent/lib/finance.types";
import { ChevronRightIcon } from "lucide-react";
import { fmtMoneyShort, fmtMonthShort, QUESTION_TOPICS } from "./use-finance-highlights";

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

export function ChatEmptyState({
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
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-7 px-4 py-10 sm:px-6">
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
        ) : (
          <BriefingSkeleton />
        )}

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

// Same grid, tile count, and padding as Briefing so swapping the skeleton
// for the real tiles once /api/finance/highlights resolves doesn't reflow
// anything below it (composer, suggested queries) — the fetch is fast but
// not instant, and a height change there reads as a jarring jump.
function BriefingSkeleton() {
  return (
    <div aria-hidden className="grid gap-3 sm:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div
          className="animate-pulse rounded-xl border border-border/60 bg-card/40 px-4 py-3"
          key={i}
        >
          <div className="h-[13px] w-20 rounded bg-muted/60" />
          <div className="mt-2 h-[17px] w-28 rounded bg-muted/60" />
          <div className="mt-1.5 h-3 w-24 rounded bg-muted/40" />
        </div>
      ))}
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
