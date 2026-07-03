import { defineEvalConfig } from "eve/evals";

// No judge model configured: every eval in this suite is deterministic
// (asserts on tool inputs/outputs and reply substrings), so there is nothing
// for an LLM-as-judge assertion to grade yet. Add `judge: { model: "..." }`
// here if a future eval needs fuzzy/quality grading via `t.judge.autoevals`.
export default defineEvalConfig({});
