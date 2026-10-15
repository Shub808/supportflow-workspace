import type { Metadata } from "next";

import { FilterRail } from "@/components/inbox/filter-rail";
import { SearchForm } from "@/components/inbox/search-form";
import { TicketList } from "@/components/inbox/ticket-list";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Chip } from "@/components/ui/primitives";
import {
  activeFilterCount,
  parseInboxQuery,
  toTicketFilter,
} from "@/lib/filters";
import { formatCount } from "@/lib/format";
import { requestNow } from "@/lib/now";
import { currentAgent } from "@/server/auth/current-user";
import {
  listAgents,
  listAllLabels,
  listTickets,
  statusCounts,
} from "@/server/repo/tickets";

export const metadata: Metadata = { title: "Inbox" };

/**
 * The inbox.
 *
 * Rendered entirely on the server: the filters are links, the search is a GET
 * form, and the data is read directly from SQLite in the same process. No
 * client-side data fetching, no loading spinner, and the whole page works
 * before any JavaScript has run.
 */
export default async function InboxPage(props: PageProps<"/inbox">) {
  const agent = (await currentAgent())!;
  const query = parseInboxQuery(await props.searchParams);
  const page = listTickets(toTicketFilter(query));
  const now = requestNow();

  return (
    <WorkspaceShell agent={agent} current="inbox">
      <div className="flex">
        <div className="hidden lg:block">
          <FilterRail
            query={query}
            agents={listAgents()}
            labels={listAllLabels()}
            counts={statusCounts()}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
            <h1 className="text-base font-semibold text-ink">Inbox</h1>
            <Chip tone="neutral">
              {formatCount(page.total)}{" "}
              {page.total === 1 ? "ticket" : "tickets"}
            </Chip>
            {activeFilterCount(query) > 0 ? (
              <Chip tone="accent">
                {activeFilterCount(query)} filter
                {activeFilterCount(query) === 1 ? "" : "s"} active
              </Chip>
            ) : null}
            <div className="w-full sm:ml-auto sm:w-80">
              <SearchForm query={query} />
            </div>
          </div>

          <TicketList page={page} query={query} now={now} />
        </div>
      </div>
    </WorkspaceShell>
  );
}
