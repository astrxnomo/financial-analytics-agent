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
  // No custom session limits — using eve's generous defaults since the
  // Mistral usage here is free-tier and cost isn't a concern.
});
