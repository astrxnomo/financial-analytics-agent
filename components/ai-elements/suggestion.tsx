"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SuggestionsProps = ComponentProps<"div">;

export const Suggestions = ({ className, ...props }: SuggestionsProps) => (
  <div className={cn("flex flex-wrap gap-2", className)} {...props} />
);

export type SuggestionProps = ComponentProps<typeof Button> & {
  suggestion: string;
  onSuggestionSelect?: (suggestion: string) => void;
};

export const Suggestion = ({
  suggestion,
  onSuggestionSelect,
  className,
  children,
  variant = "outline",
  size = "sm",
  ...props
}: SuggestionProps) => (
  <Button
    className={cn("h-auto rounded-full px-3 py-1.5 text-sm font-normal", className)}
    onClick={() => onSuggestionSelect?.(suggestion)}
    size={size}
    type="button"
    variant={variant}
    {...props}
  >
    {children ?? suggestion}
  </Button>
);
