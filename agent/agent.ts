import { defineAgent } from "eve";
import { mistral } from "@ai-sdk/mistral";

export default defineAgent({
  model: mistral("mistral-large-latest"),
  // Manually maintained: bypassing the AI Gateway means eve can't look this
  // up from catalog metadata. Update if Mistral revises Large's context window.
  modelContextWindowTokens: 128000,
});
