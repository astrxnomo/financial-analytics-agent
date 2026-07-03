import { defineAgent } from "eve";
import { mistral } from "@ai-sdk/mistral";

export default defineAgent({
  model: mistral("mistral-large-latest"),
  modelContextWindowTokens: 128000,
});
