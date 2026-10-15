import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Composer } from "@/components/ticket/composer";
import { Conversation } from "@/components/ticket/conversation";
import { CustomerPanel } from "@/components/ticket/customer-panel";
import { TicketControls } from "@/components/ticket/ticket-controls";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Chip, Panel } from "@/components/ui/primitives";
import { PriorityBadge, StatusBadge } from "@/components/ui/status";
import { formatDateTime } from "@/lib/format";
import { requestNow } from "@/lib/now";
import { currentAgent } from "@/server/auth/current-user";
import { can } from "@/server/auth/roles";
import { listSavedReplies } from "@/server/repo/knowledge";
import {
  customerHistory,
  getTicket,
  listAgents,
  listAllLabels,
  listEvents,
  listMessages,
} from "@/server/repo/tickets";

export async function generateMetadata(
  props: PageProps<"/tickets/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const ticket = getTicket(id);
  return { title: ticket ? `${ticket.reference} — ${ticket.subject}` : "Ticket" };
}

/**
 * Ticket detail.
 *
 * Server Component for everything that is just data, with two client islands:
 * the property controls (optimistic updates) and the composer (AI panel and
 * draft state). That split is the point — the thread, the customer panel and
 * the activity log never reach the browser as JavaScript.
 */
export default async function TicketPage(props: PageProps<"/tickets/[id]">) {
  const { id } = await props.params;
  const agent = (await currentAgent())!;
  const ticket = getTicket(id);
  if (!ticket) notFound();

  const now = requestNow();
  const messages = listMessages(ticket.id);
  const events = listEvents(ticket.id);
  const history = customerHistory(ticket.customerId, ticket.id);

  return (
    <WorkspaceShell agent={agent} current="inbox">
      <div className="grid min-h-[calc(100dvh-3.5rem)] grid-cols-1 lg:grid-cols-[1fr_20rem]">
        <section className="flex min-w-0 flex-col border-r border-line">
          <header className="border-b border-line px-4 py-3">
            <Link
              href="/inbox"
              className="text-xs text-muted hover:text-ink"
            >
              ← Back to inbox
            </Link>
            <h1 className="mt-1 text-base font-semibold text-ink">
              {ticket.subject}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted">
                {ticket.reference}
              </span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <Chip tone="neutral">via {ticket.channel}</Chip>
              {ticket.labels.map((label) => (
                <Chip key={label} tone="accent">
                  {label}
                </Chip>
              ))}
              <span className="tabular ml-auto text-xs text-subtle">
                Opened {formatDateTime(ticket.createdAt)} · revision{" "}
                {ticket.version}
              </span>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <Conversation messages={messages} events={events} now={now} />
          </div>

          <Composer
            ticket={ticket}
            savedReplies={listSavedReplies()}
            canReply={can(agent.role, "ticket:reply")}
            canNote={can(agent.role, "ticket:note")}
            canClose={can(agent.role, "ticket:close")}
          />
        </section>

        <aside
          aria-label="Ticket properties and customer context"
          className="space-y-4 px-4 py-4"
        >
          <Panel className="p-3">
            <TicketControls
              ticket={ticket}
              agents={listAgents()}
              allLabels={listAllLabels()}
              currentAgentId={agent.id}
              capabilities={{
                changeStatus: can(agent.role, "ticket:change_status"),
                changePriority: can(agent.role, "ticket:change_priority"),
                assignSelf: can(agent.role, "ticket:assign_self"),
                assignOthers: can(agent.role, "ticket:assign_others"),
                label: can(agent.role, "ticket:label"),
                close: can(agent.role, "ticket:close"),
              }}
            />
          </Panel>

          <Panel className="p-3">
            <CustomerPanel ticket={ticket} history={history} now={now} />
          </Panel>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
