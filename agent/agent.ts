import { defineAgent } from "eve";
import { mistral } from "@ai-sdk/mistral";

export default defineAgent({
  // Model comparison (see pnpm eval, the evals/ directory):
  // - devstral-latest (original): Mistral's agentic-coding model, not a
  //   generalist reasoner. Root cause of a class of arithmetic/narrative-
  //   bias bugs (e.g. asserting "expenses decreased" for a period where
  //   they clearly increased, even after being shown the correct
  //   subtraction).
  // - mistral-large-latest: hit persistent "Rate limit exceeded" on this
  //   API key even at eval --max-concurrency 1 — not usable with the
  //   current credentials, likely a paid-tier-only model this key isn't
  //   provisioned for.
  // - mistral-small-latest: no rate-limit issues, but behaviorally
  //   inconsistent — evals/anomaly-category-filter.eval.ts failed roughly
  //   half the time across repeated runs (sometimes returns zero anomalies
  //   for a category pair that demonstrably has some in the seeded data).
  // - mistral-medium-latest (current): passes the full eval suite
  //   consistently, including the arithmetic-safety regression test, and
  //   gave a noticeably better answer on an open-ended reasoning question
  //   (correctly identified both recurring Cloud Infrastructure spikes with
  //   exact figures, vs. Devstral's vaguer "may recur occasionally"). Does
  //   occasionally hit transient per-minute rate limits under heavy
  //   back-to-back eval runs — space out `pnpm eval` invocations if that
  //   happens. Unlike Devstral this is metered, paid API usage, not free
  //   tier.
  model: mistral("mistral-medium-latest"),
  // Manually maintained: bypassing the AI Gateway means eve can't look this
  // up from catalog metadata. Update if Mistral revises Medium's context window.
  modelContextWindowTokens: 128000,
  // Aggressive compaction to keep context focused on current task
  compaction: {
    thresholdPercent: 0.7, // compact at 70% to prevent bloat
  },
  // No custom session limits — using eve's generous defaults. Revisit this
  // if usage volume grows, since mistral-medium-latest (unlike the previous
  // devstral-latest) is metered API usage rather than free tier.
});
