"use client";

import type { Highlights } from "@/agent/lib/finance.types";
import type { useEveAgent } from "eve/react";
import { ChartColumnIcon, Code2Icon, ExternalLinkIcon, SquarePenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { fmtMonthShort } from "./use-finance-highlights";

const BRAND_NAME = "Financial Analytics";

export type AgentStatus = ReturnType<typeof useEveAgent>["status"];

// The whole top bar: brand, live date range, REST API browser, new-chat
// reset, and connection status. A flat full-width bar with a bottom border
// only — no floating card, shadow, or blur — for a plainer, more
// professional read than a chat-widget chrome.
export function ChatHeader({
  agentStatus,
  isEmpty,
  hasError,
  highlights,
  onNewChat,
}: {
  readonly agentStatus: AgentStatus;
  readonly isEmpty: boolean;
  readonly hasError: boolean;
  readonly highlights: Highlights | undefined;
  readonly onNewChat: () => void;
}) {
  return (
    <header className="z-10 flex h-14 w-full shrink-0 items-center justify-between gap-3 border-border/60 border-b px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <ChartColumnIcon className="size-4 shrink-0 text-primary" />
        <span className="truncate font-medium text-sm tracking-tight">{BRAND_NAME}</span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {highlights ? (
          <span className="hidden px-2 text-muted-foreground text-xs tabular-nums md:inline">
            {fmtMonthShort(highlights.dataFrom)} – {fmtMonthShort(highlights.dataTo)}
          </span>
        ) : null}
        {highlights ? <ApiMenu highlights={highlights} /> : null}
        <NavIconButton disabled={isEmpty && !hasError} label="New chat" onClick={onNewChat}>
          <SquarePenIcon className="size-4" />
        </NavIconButton>
        <span aria-hidden className="mx-2 h-4 w-px bg-border" />
        <StatusIndicator status={agentStatus} />
      </div>
    </header>
  );
}

// Plain icon-only nav action (not a dropdown trigger) — wrapped in a
// TooltipProvider-mounted Tooltip (see app/layout.tsx) instead of a native
// `title` attribute, consistent with the rest of the design system.
function NavIconButton({
  children,
  disabled,
  label,
  onClick,
}: {
  readonly children: React.ReactNode;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          className="text-muted-foreground hover:text-foreground"
          disabled={disabled}
          onClick={onClick}
          size="icon-sm"
          variant="ghost"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

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

// Browsable REST surface, prefilled with the live dataset's own date range —
// the same shared lib backing these routes is what the agent's tools call.
function ApiMenu({ highlights }: { readonly highlights: Highlights }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Browse REST API"
          className="text-muted-foreground hover:text-foreground"
          size="icon-sm"
          title="REST API"
          variant="ghost"
        >
          <Code2Icon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Finance REST API
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {apiEndpoints(highlights).map((endpoint) => (
          <DropdownMenuItem asChild key={endpoint.href}>
            <a href={endpoint.href} rel="noreferrer" target="_blank">
              <span className="flex-1 truncate font-mono text-xs">{endpoint.label}</span>
              <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground" />
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
