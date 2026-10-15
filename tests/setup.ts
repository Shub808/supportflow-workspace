import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  // Harmless in the node environment, required for the jsdom component tests.
  try {
    cleanup();
  } catch {
    /* no DOM in this environment */
  }
});
