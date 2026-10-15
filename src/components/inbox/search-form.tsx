import type { InboxQuery } from "@/lib/filters";

/**
 * Inbox search.
 *
 * A plain GET form: it submits to the same route with `?q=`, which means it
 * works before hydration and without JavaScript, and the result is a real URL.
 * The hidden inputs carry the other active filters through, so searching does
 * not silently discard the queue the user is looking at.
 */
export function SearchForm({ query }: { query: InboxQuery }) {
  return (
    <form action="/inbox" method="get" role="search" className="flex-1">
      {query.status.length > 0 ? (
        <input type="hidden" name="status" value={query.status.join(",")} />
      ) : null}
      {query.priority.length > 0 ? (
        <input type="hidden" name="priority" value={query.priority.join(",")} />
      ) : null}
      {query.label.length > 0 ? (
        <input type="hidden" name="label" value={query.label.join(",")} />
      ) : null}
      {query.assignee ? (
        <input type="hidden" name="assignee" value={query.assignee} />
      ) : null}
      {query.sort !== "updated" ? (
        <input type="hidden" name="sort" value={query.sort} />
      ) : null}

      <label htmlFor="inbox-search" className="sr-only">
        Search tickets by subject, reference, customer or company
      </label>
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <circle cx="9" cy="9" r="5.5" />
          <path d="m13.2 13.2 3.3 3.3" strokeLinecap="round" />
        </svg>
        <input
          id="inbox-search"
          type="search"
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="Search subject, reference, customer or company"
          className="h-9 w-full rounded-(--radius-control) border border-line-strong bg-surface pr-3 pl-8 text-sm text-ink placeholder:text-subtle"
        />
      </div>
    </form>
  );
}
