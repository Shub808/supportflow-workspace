import { z } from "zod";

import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/types/domain";

/**
 * Input schemas for every server action.
 *
 * Server Actions are publicly reachable HTTP endpoints. The arguments they
 * receive are whatever the caller sent, not whatever the component passed, so
 * each one is parsed here before anything touches the database.
 */

const ticketId = z.string().regex(/^tkt_[0-9a-z-]{1,64}$/i, "Unknown ticket");
const version = z.coerce.number().int().min(1, "Missing revision token");

export const statusSchema = z.object({
  ticketId,
  version,
  status: z.enum(TICKET_STATUSES),
});

export const prioritySchema = z.object({
  ticketId,
  version,
  priority: z.enum(TICKET_PRIORITIES),
});

export const assignSchema = z.object({
  ticketId,
  version,
  // "" is the explicit "unassign" value a <select> can carry.
  assigneeId: z
    .string()
    .max(64)
    .transform((value) => (value.trim() === "" ? null : value.trim())),
});

export const labelSchema = z.object({
  ticketId,
  version,
  label: z
    .string()
    .trim()
    .min(2, "Labels need at least two characters")
    .max(24, "Labels are limited to 24 characters")
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, numbers and hyphens"),
});

export const replySchema = z.object({
  ticketId,
  version,
  body: z
    .string()
    .trim()
    .min(10, "A reply needs at least 10 characters")
    .max(10_000, "Replies are limited to 10,000 characters"),
  /**
   * A checkbox-style flag arriving from a form.
   *
   * Accepts any string rather than a closed union of the "truthy" ones: an
   * earlier version only allowed "on" | "true" | "false", so the perfectly
   * ordinary value "off" failed validation and silently turned every public
   * reply into "your reply was not sent". Parse permissively, interpret
   * strictly.
   */
  internal: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) =>
      value === true || value === "on" || value === "true",
    ),
  nextStatus: z
    .union([z.enum(TICKET_STATUSES), z.literal("")])
    .optional()
    .transform((value) => (value === "" || value === undefined ? undefined : value)),
});

export const aiSchema = z.object({
  ticketId,
  mode: z.enum(["summarise", "draft"]),
  instruction: z.string().trim().max(500).optional().default(""),
});

export const signInSchema = z.object({
  agentId: z.string().regex(/^agt_[a-z]+$/, "Pick a demo profile"),
});

/** Turns a Zod error into `{ field: message }` for inline form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}
