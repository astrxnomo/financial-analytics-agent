"use client";

import { useEveAgent } from "eve/react";
import { AlertCircleIcon, RotateCcwIcon } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { AgentMessage } from "./agent-message";
import { ChatEmptyState } from "./agent-chat/empty-state";
import { ChatHeader } from "./agent-chat/nav";
import { lastFinanceTool, lastUserText, QUESTION_INDEX_BY_TOOL, sentQuestions } from "./agent-chat/session-helpers";
import { useFinanceHighlights } from "./agent-chat/use-finance-highlights";

export function AgentChat() {
  const agent = useEveAgent();
  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isEmpty = agent.data.messages.length === 0;
  const { highlights, questions } = useFinanceHighlights();
  const followupTool = isBusy ? undefined : lastFinanceTool(agent.data.messages.at(-1));
  const asked = sentQuestions(agent.data.messages);
  const followups =
    followupTool !== undefined
      ? questions
          .filter(
            (question, i) => i !== QUESTION_INDEX_BY_TOOL[followupTool] && !asked.has(question),
          )
          .slice(0, 3)
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

  const composer = (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea placeholder="Query revenue, budgets, or spending…" />
      <PromptInputSubmit onStop={agent.stop} status={agent.status} />
    </PromptInput>
  );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <ChatHeader
        agentStatus={agent.status}
        hasError={Boolean(agent.error)}
        highlights={highlights}
        isEmpty={isEmpty}
        onNewChat={() => agent.reset()}
      />

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
            <div className="mx-auto w-full max-w-4xl shrink-0 px-4 pb-3 sm:px-6">
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

          <div className="mx-auto w-full max-w-4xl shrink-0 px-4 pb-4 sm:px-6">{composer}</div>
        </>
      )}
    </main>
  );
}
