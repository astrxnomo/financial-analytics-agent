"use client";

import type { Highlights } from "@/agent/lib/finance.types";
import {
  AlertTriangleIcon,
  Building2Icon,
  type LucideIcon,
  PieChartIcon,
  ReceiptTextIcon,
  RocketIcon,
  TrendingUpIcon,
  WalletIcon,
  WavesIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  fmtMoneyShort,
  fmtMonthShort,
  QUESTION_TOPICS,
} from "./use-finance-highlights";

// Index-aligned with QUESTION_TOPICS (see use-finance-highlights.ts) — one
// icon per suggested-query card.
const QUESTION_ICONS: readonly LucideIcon[] = [
  TrendingUpIcon,
  WalletIcon,
  AlertTriangleIcon,
  ReceiptTextIcon,
  WavesIcon,
  PieChartIcon,
  Building2Icon,
  RocketIcon,
];

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
    <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
      <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-4 px-4 sm:px-6">
        <div className="space-y-0.5">
          <p className="text-muted-foreground text-xs" suppressHydrationWarning>
            {fmtToday()}
          </p>
          <h1
            className="font-semibold text-xl tracking-tight"
            suppressHydrationWarning
          >
            {timeGreeting()}
          </h1>
          <p className="text-muted-foreground text-sm">
            Query revenue, budget performance, and spending anomalies across
            departments.
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
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-3xl shrink flex-col gap-2 px-4 pt-4 pb-3 sm:px-6">
        <p className="shrink-0 text-muted-foreground text-xs">
          Suggested prompts
        </p>
        <div className="grid grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
          {questions.map((question, index) => {
            const Icon =
              QUESTION_ICONS[index % QUESTION_ICONS.length] ?? WalletIcon;
            const topic = QUESTION_TOPICS[index % QUESTION_TOPICS.length];
            return (
              <Tooltip delayDuration={150} key={question}>
                <TooltipTrigger asChild>
                  <button
                    className="group flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-card/40 px-3 py-4 text-center transition-colors hover:border-primary/40 hover:bg-card"
                    onClick={() => onSuggestionSelect(question)}
                    type="button"
                  >
                    <Icon className="size-5 text-muted-foreground transition-colors group-hover:text-primary" />
                    <span className="text-xs">{topic}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64 space-y-1 py-2 shadow-xl" side="top" sideOffset={8}>
                  <p className="font-semibold text-[11px] text-primary uppercase tracking-wide">
                    {topic}
                  </p>
                  <p className="text-[13px] leading-snug">{question}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
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
            <p className="mt-1 truncate font-medium text-sm tabular-nums">
              {tile.value}
            </p>
            <p className="mt-0.5 truncate text-muted-foreground text-xs">
              {tile.detail}
            </p>
          </button>
        );
      })}
    </div>
  );
}
