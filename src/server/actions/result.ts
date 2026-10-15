import type { TicketWithCustomer } from "@/types/domain";

/**
 * The shape every server action returns.
 *
 * A discriminated union rather than throwing: `useActionState` renders
 * whatever comes back, and a conflict carries the *current* server state so
 * the client can show the user what actually happened instead of a bare
 * "something went wrong".
 */
export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string; ticket?: TicketWithCustomer }
  | { status: "invalid"; message: string; errors: Record<string, string> }
  | { status: "forbidden"; message: string }
  | { status: "conflict"; message: string; ticket: TicketWithCustomer }
  | { status: "error"; message: string };

export const IDLE: ActionState = { status: "idle" };

export const CONFLICT_MESSAGE =
  "Someone else updated this ticket while you were working on it. The latest version is shown below — review it and try again.";

/**
 * The assistant's rendered state.
 *
 * Deliberately declared here rather than beside the action: a `"use server"`
 * module may only export async functions, so a plain object exported from one
 * arrives as `undefined` in the client component that imports it. That failure
 * is silent at build time and shows up as a runtime `TypeError` on first
 * render — which is exactly how it was found.
 */
export interface AiActionState {
  status: "idle" | "ready" | "error";
  text: string;
  notes: string[];
  citations: string[];
  provider: string;
  simulated: boolean;
  message?: string;
}

export const AI_IDLE: AiActionState = {
  status: "idle",
  text: "",
  notes: [],
  citations: [],
  provider: "",
  simulated: true,
};
