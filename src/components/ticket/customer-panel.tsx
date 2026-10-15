import Link from "next/link";
import type { Route } from "next";

import { PriorityBadge, StatusBadge } from "@/components/ui/status";
import { Chip } from "@/components/ui/primitives";
import { formatDate, relativeAge } from "@/lib/format";
import type { TicketWithCustomer } from "@/types/domain";

/** Customer context and their other tickets. */
export function CustomerPanel({
  ticket,
  history,
  now,
}: {
  ticket: TicketWithCustomer;
  history: TicketWithCustomer[];
  now: number;
}) {
  const plan = ticket.customer.plan;
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">
          Customer
        </h3>
        <p className="text-sm font-medium text-ink">{ticket.customer.name}</p>
        <p className="font-mono text-xs break-all text-muted">
          {ticket.customer.email}
        </p>
        <dl className="mt-2 space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Company</dt>
            <dd className="text-right font-medium text-ink">
              {ticket.customer.company}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">Plan</dt>
            <dd>
              <Chip tone={plan === "enterprise" ? "accent" : plan === "pro" ? "info" : "neutral"}>
                {plan}
              </Chip>
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Customer since</dt>
            <dd className="tabular text-right text-ink">
              {formatDate(ticket.customer.since)}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">
          Their other tickets ({history.length})
        </h3>
        {history.length === 0 ? (
          <p className="text-xs text-subtle">
            This is their only ticket on record.
          </p>
        ) : (
          <ul className="space-y-1">
            {history.map((other) => (
              <li key={other.id}>
                <Link
                  href={`/tickets/${other.id}` as Route}
                  className="block rounded-(--radius-control) border border-line px-2 py-1.5 hover:bg-surface-muted"
                >
                  <span className="block truncate text-xs font-medium text-ink">
                    {other.subject}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1">
                    <StatusBadge status={other.status} />
                    <PriorityBadge priority={other.priority} />
                    <span className="tabular ml-auto text-xs text-subtle">
                      {relativeAge(other.updatedAt, now)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
