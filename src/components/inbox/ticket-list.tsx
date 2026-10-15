import Link from "next/link";
import type { Route } from "next";

import { PriorityBadge, StatusBadge } from "@/components/ui/status";
import { Avatar, Chip, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { buildInboxSearch, type InboxQuery } from "@/lib/filters";
import { formatCount, relativeAge } from "@/lib/format";
import type { Paginated, TicketWithCustomer } from "@/types/domain";

/**
 * Ticket list.
 *
 * A `<ul>` of links rather than a table: each row is one navigable thing, and
 * a link gives keyboard activation, middle-click, "open in new tab" and a
 * real focus ring without any of it being re-implemented.
 *
 * `now` is passed in from the page so every relative timestamp on a render is
 * computed against the same instant, and so the value is deterministic in
 * tests.
 */
export function TicketList({
  page,
  query,
  selectedId,
  now,
}: {
  page: Paginated<TicketWithCustomer>;
  query: InboxQuery;
  selectedId?: string;
  now: number;
}) {
  if (page.rows.length === 0) {
    return (
      <EmptyState
        title="No tickets match these filters"
        description="Clear a status or priority filter, or widen the search."
        action={
          <Link
            href={"/inbox" as Route}
            className="mt-2 inline-flex h-8 items-center rounded-(--radius-control) bg-accent-600 px-3 text-xs font-medium text-white"
          >
            Reset filters
          </Link>
        }
      />
    );
  }

  const first = (page.page - 1) * page.pageSize + 1;
  const last = Math.min(page.page * page.pageSize, page.total);

  const pageHref = (next: number): Route => {
    const search = buildInboxSearch(query, { page: next });
    return (search ? `/inbox?${search}` : "/inbox") as Route;
  };

  return (
    <div className="flex min-h-0 flex-col">
      <ul className="divide-y divide-line">
        {page.rows.map((ticket) => {
          const selected = ticket.id === selectedId;
          return (
            <li key={ticket.id}>
              <Link
                href={`/tickets/${ticket.id}` as Route}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "block px-4 py-3 transition-colors",
                  selected
                    ? "bg-accent-tint"
                    : "hover:bg-surface-muted",
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={ticket.customer.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="truncate text-sm font-medium text-ink">
                        {ticket.subject}
                      </p>
                      <span className="tabular ml-auto shrink-0 text-xs text-subtle">
                        {relativeAge(ticket.lastMessageAt, now)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      <span className="font-mono">{ticket.reference}</span>
                      {" · "}
                      {ticket.customer.name} · {ticket.customer.company}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-subtle">
                      {ticket.lastMessagePreview}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={ticket.status} />
                      <PriorityBadge priority={ticket.priority} />
                      {ticket.labels.map((label) => (
                        <Chip key={label}>{label}</Chip>
                      ))}
                      <span className="ml-auto text-xs text-subtle">
                        {ticket.assignee ? ticket.assignee.name : "Unassigned"}
                        {" · "}
                        {formatCount(ticket.messageCount)} message
                        {ticket.messageCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <nav
        aria-label="Ticket pagination"
        className="flex items-center justify-between gap-3 border-t border-line px-4 py-3"
      >
        <p className="tabular text-xs text-muted">
          {formatCount(first)}–{formatCount(last)} of {formatCount(page.total)}
        </p>
        <div className="flex items-center gap-1">
          {page.page > 1 ? (
            <Link
              href={pageHref(page.page - 1)}
              className="rounded-(--radius-control) border border-line-strong px-2.5 py-1 text-xs text-ink hover:bg-surface-muted"
            >
              Prev page
            </Link>
          ) : (
            <span className="rounded-(--radius-control) border border-line px-2.5 py-1 text-xs text-subtle">
              Prev page
            </span>
          )}
          <span className="tabular px-1.5 text-xs text-muted">
            {page.page} / {page.pageCount}
          </span>
          {page.page < page.pageCount ? (
            <Link
              href={pageHref(page.page + 1)}
              className="rounded-(--radius-control) border border-line-strong px-2.5 py-1 text-xs text-ink hover:bg-surface-muted"
            >
              Next page
            </Link>
          ) : (
            <span className="rounded-(--radius-control) border border-line px-2.5 py-1 text-xs text-subtle">
              Next page
            </span>
          )}
        </div>
      </nav>
    </div>
  );
}
