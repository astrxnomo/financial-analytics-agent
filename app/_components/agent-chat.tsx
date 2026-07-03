"use client";

import type { Highlights } from "@/agent/lib/finance.types";
import type { LanguageModelUsage } from "ai";
import { useEveAgent } from "eve/react";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  Code2Icon,
  ExternalLinkIcon,
  RotateCcwIcon,
  SquarePenIcon,
} from "lucide-react";
import { useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Context,
  ContextCacheUsage,
  ContextContent,
  ContextContentBody,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextTrigger,
} from "@/components/ai-elements/context";
import {
  PromptInput,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputButton,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Button } from "@/components/ui/button";
import { DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AgentMessage } from "./agent-message";
import { ChatEmptyState } from "./agent-chat/empty-state";
import {
  contextualFollowups,
  lastFinanceTool,
  lastUserText,
  QUESTION_INDEX_BY_TOOL,
  sentQuestions,
} from "./agent-chat/session-helpers";
import { useFinanceHighlights } from "./agent-chat/use-finance-highlights";

// REST surface built from the same shared lib the agent's tools call, so
// this browses the finance API directly, prefilled with real dates from the
// live dataset instead of placeholder query params.
function apiEndpoints(h: Highlights): readonly { label: string; href: string }[] {
  const range = `from=${h.dataFrom}&to=${h.dataTo}`;
  return [
    { href: `/api/finance/summary?${range}`, label: "GET /summary" },
    { href: `/api/finance/trend?metric=income&groupBy=month&${range}`, label: "GET /trend" },
    { href: `/api/finance/budget-status?month=${h.latestMonth}`, label: "GET /budget-status" },
    { href: `/api/finance/anomalies?${range}`, label: "GET /anomalies" },
    { href: `/api/finance/category-breakdown?${range}`, label: "GET /category-breakdown" },
    { href: `/api/finance/cashflow?${range}`, label: "GET /cashflow" },
    { href: "/api/finance/data-overview", label: "GET /data-overview" },
  ];
}

// Mirrors agent/agent.ts's modelContextWindowTokens — eve doesn't expose the
// server-side agent config to the client, so this has to be kept in sync by
// hand (same constraint the agent.ts comment already calls out for that
// value itself).
const MODEL_CONTEXT_WINDOW_TOKENS = 128_000;

export function AgentChat() {
  // eve retries a failed model call (e.g. provider rate limit) internally
  // and, if all retries are exhausted, emits `turn.failed` + `session.waiting`
  // — a "park for retry" outcome, not `session.failed`. The client only
  // turns `session.failed` into `agent.error`, so that class of failure
  // never reaches the error banner below; this raw-event listener is the
  // only way to catch it and let the user know the turn didn't go through.
  const [turnWarning, setTurnWarning] = useState<string | undefined>(undefined);
  // Usage from the most recently completed model call — the closest proxy
  // available for "how full is the context window right now", since eve
  // doesn't surface a running session-level token total.
  const [latestUsage, setLatestUsage] = useState<LanguageModelUsage | undefined>(undefined);
  const agent = useEveAgent({
    onEvent: (event) => {
      if (event.type === "turn.failed") {
        setTurnWarning(event.data.message || "The request failed. Please try again.");
      } else if (event.type === "turn.started") {
        setTurnWarning(undefined);
      } else if (event.type === "step.completed" && event.data.usage) {
        const { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } = event.data.usage;
        setLatestUsage({
          inputTokenDetails: {
            cacheReadTokens,
            cacheWriteTokens,
            noCacheTokens: undefined,
          },
          inputTokens,
          outputTokenDetails: { reasoningTokens: undefined, textTokens: undefined },
          outputTokens,
          totalTokens:
            inputTokens !== undefined && outputTokens !== undefined
              ? inputTokens + outputTokens
              : undefined,
        });
      }
    },
  });
  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isEmpty = agent.data.messages.length === 0;
  const { highlights, questions } = useFinanceHighlights();
  const lastMessage = agent.data.messages.at(-1);
  const followupTool = isBusy ? undefined : lastFinanceTool(lastMessage);
  const asked = sentQuestions(agent.data.messages);
  // Thread-specific follow-ups (same department/category as the answer just
  // given) come first; the generic pool only fills remaining slots, so a
  // targeted question never gets pushed out by an unrelated static one.
  const threaded = isBusy ? [] : contextualFollowups(lastMessage).filter((q) => !asked.has(q));
  const followups =
    followupTool !== undefined
      ? [
          ...threaded,
          ...questions.filter(
            (question, i) => i !== QUESTION_INDEX_BY_TOOL[followupTool] && !asked.has(question),
          ),
        ].slice(0, 3)
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

  const handleRetry = () => {
    const text = lastUserText(agent.data.messages);
    if (text) void agent.send({ message: text });
  };

  const handleNewChat = () => {
    setTurnWarning(undefined);
    agent.reset();
  };

  const composer = (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea placeholder="Query revenue, budgets, or spending…" />
      <PromptInputFooter>
        <PromptInputTools>
          <PromptInputButton
            aria-label="New chat"
            disabled={isEmpty && !agent.error}
            onClick={handleNewChat}
            tooltip="New chat"
          >
            <SquarePenIcon className="size-4" />
          </PromptInputButton>
          {highlights ? (
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger aria-label="Browse REST API" tooltip="REST API">
                <Code2Icon className="size-4" />
              </PromptInputActionMenuTrigger>
              <PromptInputActionMenuContent className="w-64">
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  Finance REST API
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {apiEndpoints(highlights).map((endpoint) => (
                  <PromptInputActionMenuItem asChild key={endpoint.href}>
                    <a href={endpoint.href} rel="noreferrer" target="_blank">
                      <span className="flex-1 truncate font-mono text-xs">{endpoint.label}</span>
                      <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground" />
                    </a>
                  </PromptInputActionMenuItem>
                ))}
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
          ) : null}
          {latestUsage ? (
            <Context
              maxTokens={MODEL_CONTEXT_WINDOW_TOKENS}
              usage={latestUsage}
              usedTokens={(latestUsage.inputTokens ?? 0) + (latestUsage.outputTokens ?? 0)}
            >
              <ContextTrigger className="h-8 gap-1 px-2 text-xs" size="sm" variant="ghost" />
              <ContextContent>
                <ContextContentHeader />
                <ContextContentBody>
                  <ContextInputUsage />
                  <ContextOutputUsage />
                  <ContextCacheUsage />
                </ContextContentBody>
              </ContextContent>
            </Context>
          ) : null}
        </PromptInputTools>
      </PromptInputFooter>
      <PromptInputSubmit onStop={agent.stop} status={agent.status} />
    </PromptInput>
  );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1 flex-col">
        {agent.error ? (
          <div className="mx-auto w-full max-w-4xl shrink-0 px-4 pt-3 sm:px-6">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Request failed</p>
                <p className="mt-0.5 text-muted-foreground">{agent.error.message}</p>
              </div>
              <Button
                className="shrink-0"
                disabled={isBusy}
                onClick={handleRetry}
                size="sm"
                variant="outline"
              >
                <RotateCcwIcon className="size-3.5" />
                Retry
              </Button>
            </div>
          </div>
        ) : null}

        {turnWarning && !agent.error ? (
          <div className="mx-auto w-full max-w-4xl shrink-0 px-4 pt-3 sm:px-6">
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Request didn't go through</p>
                <p className="mt-0.5 text-muted-foreground">{turnWarning}</p>
              </div>
              <Button
                className="shrink-0"
                disabled={isBusy}
                onClick={() => {
                  setTurnWarning(undefined);
                  handleRetry();
                }}
                size="sm"
                variant="outline"
              >
                <RotateCcwIcon className="size-3.5" />
                Retry
              </Button>
            </div>
          </div>
        ) : null}

        {isEmpty ? (
          <ChatEmptyState
            composer={composer}
            highlights={highlights}
            onSuggestionSelect={handleSuggestion}
            questions={questions}
          />
        ) : (
          <>
            <Conversation className="min-h-0 flex-1">
              <ConversationContent className="mx-auto w-full max-w-4xl gap-6 px-4 py-6 sm:px-6">
                {agent.data.messages.map((message, index) => (
                  <AgentMessage
                    canRespond={!isBusy}
                    isStreaming={
                      agent.status === "streaming" && index === agent.data.messages.length - 1
                    }
                    key={message.id}
                    message={message}
                    onInputResponses={(inputResponses) => agent.send({ inputResponses })}
                    onRegenerate={
                      !isBusy && index === agent.data.messages.length - 1 ? handleRetry : undefined
                    }
                  />
                ))}
                {agent.status === "submitted" ? (
                  <Shimmer as="p" className="fade-in-0 animate-in text-sm duration-300">
                    Analyzing the ledger…
                  </Shimmer>
                ) : null}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            {followups && followups.length > 0 ? (
              <div className="fade-in-0 mx-auto w-full max-w-4xl shrink-0 animate-in px-4 pb-3 duration-300 ease-out sm:px-6">
                <p className="mb-1.5 text-[11px] text-muted-foreground">Continue with</p>
                <Suggestions className="items-center gap-1.5">
                  {followups.map((question, index) => (
                    <Suggestion
                      className="fade-in-0 slide-in-from-bottom-1 max-w-full animate-in border-border/70 bg-transparent text-muted-foreground duration-300 ease-out hover:border-primary/40 hover:text-foreground"
                      key={question}
                      onSuggestionSelect={handleSuggestion}
                      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "backwards" }}
                      suggestion={question}
                    >
                      <span className="truncate">{question}</span>
                    </Suggestion>
                  ))}
                </Suggestions>
              </div>
            ) : null}

            <div className="mx-auto w-full max-w-4xl shrink-0 px-4 pb-4 sm:px-6">{composer}</div>
          </>
        )}
      </div>
    </main>
  );
}
