import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    restoreMocks: true,
    // Most of this codebase is server code and runs faster without a DOM.
    // The component tests opt into jsdom with a `@vitest-environment`
    // docblock, which is the per-file mechanism in Vitest 5
    // (`environmentMatchGlobs` was removed).
    setupFiles: ["./tests/setup.ts"],
  },
});
