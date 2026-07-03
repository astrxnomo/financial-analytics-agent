"use client";

import { Maximize2Icon, SearchXIcon } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ChartSize } from "./chart-tooltip";

// Report-style panel so charts and tables read as documents, not floating
// fragments.
export function Panel({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">{children}</div>
  );
}

export function ChartHeader({
  action,
  caption,
  title,
}: {
  readonly action?: React.ReactNode;
  readonly caption?: string;
  readonly title: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="font-medium text-sm">{title}</h3>
      <div className="flex items-center gap-2">
        {caption ? <span className="text-muted-foreground text-xs">{caption}</span> : null}
        {action}
      </div>
    </div>
  );
}

export function EmptyState({ message }: { readonly message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
      <SearchXIcon className="size-5 text-muted-foreground" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

export function LegendSwatch({ color, label }: { readonly color: string; readonly label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
      <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// Wraps a chart with an expand button that opens the same chart near-fullscreen.
// `render` is called twice (compact inline, large in the dialog) rather than
// portalling the compact DOM node, since these chart components are pure
// functions of their data — cheap to re-render, and it keeps the two sizes
// independently responsive to their own container width. The button itself is
// handed to `render` as `action` so each chart places it in its own
// `ChartHeader` row, next to the title and caption, instead of floating over
// the chart and colliding with that same top-right corner.
export function ChartPanel({
  render,
  title,
}: {
  readonly render: (size: ChartSize, action?: React.ReactNode) => React.ReactNode;
  readonly title: string;
}) {
  const [open, setOpen] = useState(false);
  const expandButton = (
    <button
      aria-label="Expand chart"
      className="-my-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={() => setOpen(true)}
      type="button"
    >
      <Maximize2Icon className="size-3.5" />
    </button>
  );
  return (
    <Panel>
      {render("compact", expandButton)}
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="flex h-[92vh] w-[96vw] max-w-none flex-col sm:max-w-none">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">{render("large")}</div>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
