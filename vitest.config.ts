import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // eve's dev/build runtime copies the whole source tree into
    // .eve/dev-runtime/snapshots/*/source for durable replay — without this
    // exclude, vitest's default globbing picks up those copies too and
    // silently multiplies every test (and re-runs assertions against
    // whatever stale snapshot each one froze).
    exclude: [
      "**/node_modules/**",
      "**/.eve/**",
      "**/.next/**",
      "**/.output/**",
      "**/.workflow-data/**",
    ],
  },
});
