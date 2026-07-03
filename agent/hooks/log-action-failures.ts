import { defineHook } from "eve/hooks";

// Surfaces tool/subagent/skill failures (like a malformed date argument
// crashing get_category_breakdown's postgres query) as a single greppable
// log line, instead of requiring a manual dig through nitro dev-server
// output or .eve/ internals to notice the model's call errored and it
// silently retried.
export default defineHook({
  events: {
    "action.result"(event) {
      const { result, status, error } = event.data;
      if (status !== "failed" && !result.isError) return;

      const name =
        result.kind === "tool-result"
          ? result.toolName
          : result.kind === "subagent-result"
            ? result.subagentName
            : (result.name ?? "load_skill");

      console.error("[eve] action failed", {
        kind: result.kind,
        name,
        callId: result.callId,
        status,
        code: error?.code,
        message: error?.message,
      });
    },
  },
});
