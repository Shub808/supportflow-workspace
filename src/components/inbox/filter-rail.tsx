import Link from "next/link";
import type { Route } from "next";

import { Chip } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { buildInboxSearch, type InboxQuery } from "@/lib/filters";
import { formatCount } from "@/lib/format";
import { TICKET_PRIORITIES, TICKET_STATUSES, type Agent } from "@/types/domain";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/components/ui/status";

/**
 * Filter rail.
 *
 * Every control is a `<Link>`, not a button with an onClick. That makes the
 * whole rail work without JavaScript, gives each filter a real URL that can be
 * opened in a new tab or shared, and keeps the component on the server.
 */

function railLink(query: InboxQuery, overrides: Partial<InboxQuery>): Route {
  const search = buildInboxSearch(query, { ...overrides, page: 1 });
  return (search ? `/inbox?${search}` : "/inbox") as Route;
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function RailItem({
  href,
  active,
  children,
  count,
}: {
  href: Route;
  active: boolean;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex items-center justify-between gap-2 rounded-(--radius-control) px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent-tint font-medium text-accent-on-tint"
          : "text-muted hover:bg-surface-muted hover:text-ink",
      )}
    >
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn(
            "size-3 rounded-[3px] border",
            active ? "border-accent-600 bg-accent-600" : "border-line-strong",
          )}
        >
          {active ? (
            <svg viewBox="0 0 12 12" className="size-full text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m3 6.2 2 2 4-4.4" strokeLinecap="round" />
            </svg>
          ) : null}
        </span>
        {children}
      </span>
      {count !== undefined ? (
        <span className="tabular text-xs text-subtle">{formatCount(count)}</span>
      ) : null}
    </Link>
  );
}

export function FilterRail({
  query,
  agents,
  labels,
  counts,
}: {
  query: InboxQuery;
  agents: Agent[];
  labels: string[];
  counts: Record<string, number>;
}) {
  return (
    <aside
      aria-label="Ticket filters"
      className="w-56 shrink-0 space-y-5 border-r border-line px-3 py-4"
    >
      <section>
        <h2 className="px-2 pb-1 text-xs font-semibold tracking-wide text-subtle uppercase">
          Queue
        </h2>
        <RailItem href={"/inbox" as Route} active={false} count={counts.all}>
          All tickets
        </RailItem>
        <RailItem
          href={railLink(query, { assignee: "unassigned" })}
          active={query.assignee === "unassigned"}
          count={counts.unassigned}
        >
          Unassigned
        </RailItem>
      </section>

      <section>
        <h2 className="px-2 pb-1 text-xs font-semibold tracking-wide text-subtle uppercase">
          Status
        </h2>
        {TICKET_STATUSES.map((status) => (
          <RailItem
            key={status}
            href={railLink(query, { status: toggle(query.status, status) })}
            active={query.status.includes(status)}
            count={counts[status] ?? 0}
          >
            {STATUS_LABEL[status]}
          </RailItem>
        ))}
      </section>

      <section>
        <h2 className="px-2 pb-1 text-xs font-semibold tracking-wide text-subtle uppercase">
          Priority
        </h2>
        {TICKET_PRIORITIES.map((priority) => (
          <RailItem
            key={priority}
            href={railLink(query, {
              priority: toggle(query.priority, priority),
            })}
            active={query.priority.includes(priority)}
          >
            {PRIORITY_LABEL[priority]}
          </RailItem>
        ))}
      </section>

      <section>
        <h2 className="px-2 pb-1 text-xs font-semibold tracking-wide text-subtle uppercase">
          Assignee
        </h2>
        {agents.map((agent) => (
          <RailItem
            key={agent.id}
            href={railLink(query, {
              assignee: query.assignee === agent.id ? undefined : agent.id,
            })}
            active={query.assignee === agent.id}
          >
            {agent.name}
          </RailItem>
        ))}
      </section>

      <section>
        <h2 className="px-2 pb-1 text-xs font-semibold tracking-wide text-subtle uppercase">
          Labels
        </h2>
        <div className="flex flex-wrap gap-1 px-1">
          {labels.map((label) => {
            const active = query.label.includes(label);
            return (
              <Link key={label} href={railLink(query, { label: toggle(query.label, label) })}>
                <Chip tone={active ? "accent" : "neutral"}>{label}</Chip>
              </Link>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
