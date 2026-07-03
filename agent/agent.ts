import { defineAgent } from "eve";
import { mistral } from "@ai-sdk/mistral";

export default defineAgent({
  model: mistral("devstral-latest"),
  // Manually maintained: bypassing the AI Gateway means eve can't look this
  // up from catalog metadata. Update if Mistral revises Large's context window.
  modelContextWindowTokens: 128000,
  // Aggressive compaction to keep context focused on current task
  compaction: {
    thresholdPercent: 0.7, // compact at 70% to prevent bloat
  },
  // Session token limits to prevent runaway costs
  limits: {
    maxInputTokensPerSession: 100_000,
    maxOutputTokensPerSession: 15_000,
  },
});
