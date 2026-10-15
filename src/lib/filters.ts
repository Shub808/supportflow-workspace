import { z } from "zod";

import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "@/types/domain";
import type { TicketFilter } from "@/server/repo/tickets";

/**
 * Inbox filter parsing.
 *
 * Unlike PulseBoard, the filters here are consumed by a Server Component
 * rather than a client fetch — but the reasoning is the same: the query string
 * is the addressable state, and it is untrusted input, so it is validated once
 * and everything downstream works with a typed object.
 */

const list = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((raw) => {
      if (raw === undefined) return [] as string[];
      const member = z.enum(values);
      const parts = (Array.isArray(raw) ? raw : [raw])
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter((value) => member.safeParse(value).success);
      return [...new Set(parts)];
    });

export const inboxQuerySchema = z.object({
  status: list(TICKET_STATUSES),
  priority: list(TICKET_PRIORITIES),
  assignee: z.string().max(64).optional(),
  label: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((raw) => {
      if (raw === undefined) return [] as string[];
      return [
        ...new Set(
          (Array.isArray(raw) ? raw : [raw])
            .flatMap((value) => value.split(","))
            .map((value) => value.trim().toLowerCase())
            .filter((value) => /^[a-z0-9][a-z0-9-]{1,23}$/.test(value)),
        ),
      ];
    }),
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : undefined)),
  sort: z.enum(["updated", "created", "priority"]).catch("updated"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type InboxQuery = z.infer<typeof inboxQuerySchema>;

export const PAGE_SIZE = 20;

export function parseInboxQuery(
  input: Record<string, string | string[] | undefined>,
): InboxQuery {
  const result = inboxQuerySchema.safeParse(input);
  // `.catch()` on the scalar fields means only a structurally impossible
  // input can fail here; defaults keep the inbox rendering regardless.
  return result.success
    ? result.data
    : {
        status: [],
        priority: [],
        assignee: undefined,
        label: [],
        q: undefined,
        sort: "updated",
        dir: "desc",
        page: 1,
      };
}

export function toTicketFilter(query: InboxQuery): TicketFilter {
  return {
    status: query.status,
    priority: query.priority,
    assigneeId:
      query.assignee && query.assignee !== "unassigned" ? query.assignee : null,
    unassigned: query.assignee === "unassigned",
    labels: query.label,
    q: query.q ?? null,
    sort: query.sort,
    dir: query.dir,
    page: query.page,
    pageSize: PAGE_SIZE,
  };
}

/** Canonical query string for links, so equivalent filters share a URL. */
export function buildInboxSearch(
  query: InboxQuery,
  overrides: Partial<InboxQuery> = {},
): string {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (merged.status.length) params.set("status", merged.status.join(","));
  if (merged.priority.length) params.set("priority", merged.priority.join(","));
  if (merged.assignee) params.set("assignee", merged.assignee);
  if (merged.label.length) params.set("label", merged.label.join(","));
  if (merged.q) params.set("q", merged.q);
  if (merged.sort !== "updated") params.set("sort", merged.sort);
  if (merged.dir !== "desc") params.set("dir", merged.dir);
  if (merged.page > 1) params.set("page", String(merged.page));
  return params.toString();
}

export function activeFilterCount(query: InboxQuery): number {
  return (
    query.status.length +
    query.priority.length +
    query.label.length +
    (query.assignee ? 1 : 0) +
    (query.q ? 1 : 0)
  );
}
