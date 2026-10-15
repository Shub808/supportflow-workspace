import { describe, expect, it } from "vitest";

import * as sessionActions from "@/server/actions/session";
import * as ticketActions from "@/server/actions/tickets";

/**
 * Regression guard for a mistake that is silent at build time.
 *
 * A `"use server"` module may only export async functions. Exporting a plain
 * object from one compiles and type-checks, but the value does not survive
 * the server/client boundary — it arrives as `undefined` in the component
 * that imports it, and the first render throws a `TypeError`. That is exactly
 * how the initial-state constant for the AI panel broke, so the constraint is
 * now asserted rather than remembered.
 */
describe('"use server" module exports', () => {
  for (const [name, module] of [
    ["tickets", ticketActions],
    ["session", sessionActions],
  ] as const) {
    it(`${name}: every export is an async function`, () => {
      const exports = Object.entries(module);
      expect(exports.length).toBeGreaterThan(0);
      for (const [key, value] of exports) {
        expect(typeof value, `${key} must be a function`).toBe("function");
        expect(
          (value as { constructor: { name: string } }).constructor.name,
          `${key} must be async`,
        ).toBe("AsyncFunction");
      }
    });
  }
});
