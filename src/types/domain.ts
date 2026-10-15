/**
 * The SupportFlow domain.
 *
 * Shared by the SQLite repositories, the server actions and the UI. The
 * literal-union + `as const` pattern gives one definition that is both a
 * runtime list (for seeding, validation and rendering filter options) and a
 * compile-time type.
 */

export const TICKET_STATUSES = [
  "new",
  "open",
  "pending",
  "resolved",
  "closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const ROLES = ["agent", "supervisor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const CHANNELS = ["email", "chat", "phone", "portal"] as const;
export type Channel = (typeof CHANNELS)[number];

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
  plan: "free" | "pro" | "enterprise";
  since: string;
}

export interface Ticket {
  id: string;
  reference: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: Channel;
  customerId: string;
  assigneeId: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  /**
   * Monotonic revision, bumped on every write. Sent back with mutations so a
   * stale client is rejected rather than silently overwriting a colleague's
   * change. See docs/adr/0002-optimistic-concurrency.md.
   */
  version: number;
}

export interface TicketWithCustomer extends Ticket {
  customer: Customer;
  assignee: Agent | null;
  messageCount: number;
  lastMessageAt: string;
  lastMessagePreview: string;
}

export type MessageAuthorKind = "customer" | "agent" | "system";

export interface Message {
  id: string;
  ticketId: string;
  authorKind: MessageAuthorKind;
  authorId: string | null;
  authorName: string;
  body: string;
  /** Internal notes are visible to staff only and never sent to the customer. */
  internal: boolean;
  createdAt: string;
}

export interface SavedReply {
  id: string;
  title: string;
  body: string;
  tags: string[];
}

export interface KbArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  updatedAt: string;
}

export interface TicketEvent {
  id: string;
  ticketId: string;
  actorId: string | null;
  actorName: string;
  kind:
    | "created"
    | "status_changed"
    | "priority_changed"
    | "assigned"
    | "unassigned"
    | "label_added"
    | "label_removed"
    | "replied"
    | "note_added";
  detail: string;
  createdAt: string;
}

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}
