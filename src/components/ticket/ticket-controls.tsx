"use client";

import { useActionState, useOptimistic } from "react";

import {
  assignAction,
  changePriorityAction,
  changeStatusAction,
  toggleLabelAction,
} from "@/server/actions/tickets";
import { IDLE, type ActionState } from "@/server/actions/result";
import { Button, Chip } from "@/components/ui/primitives";
import { PriorityBadge, StatusBadge } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type Agent,
  type TicketPriority,
  type TicketStatus,
  type TicketWithCustomer,
} from "@/types/domain";

/**
 * Ticket property controls, with optimistic updates and real rollback.
 *
 * The pattern, which is the point of this component:
 *
 *  - `useOptimistic` applies the change to the rendered ticket the instant the
 *    form is submitted, so the badge never lags behind the click.
 *  - The action runs on the server. If it succeeds, the route revalidates and
 *    the optimistic value is replaced by the real one.
 *  - If it fails — a permission denial, or a revision conflict because someone
 *    else edited the ticket first — React discards the optimistic value and
 *    the UI snaps back to the server's state. **The rollback is not
 *    hand-written; it is what `useOptimistic` does when the action settles
 *    without the underlying prop changing.** That is why the optimistic value
 *    is derived from the `ticket` prop rather than held in `useState`.
 *  - The failure is then explained in place, and a conflict shows what the
 *    server actually holds now, rather than a generic error.
 */

interface Props {
  ticket: TicketWithCustomer;
  agents: Agent[];
  allLabels: string[];
  capabilities: {
    changeStatus: boolean;
    changePriority: boolean;
    assignSelf: boolean;
    assignOthers: boolean;
    label: boolean;
    close: boolean;
  };
  currentAgentId: string;
}

type Patch = Partial<Pick<TicketWithCustomer, "status" | "priority" | "assignee" | "assigneeId" | "labels">>;

function Feedback({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;

  const tone =
    state.status === "success"
      ? "border-chip-good-br bg-chip-good-bg text-chip-good-fg"
      : state.status === "conflict"
        ? "border-chip-warn-br bg-chip-warn-bg text-chip-warn-fg"
        : "border-chip-bad-br bg-chip-bad-bg text-chip-bad-fg";

  return (
    <p
      role={state.status === "success" ? "status" : "alert"}
      className={cn("rounded-(--radius-control) border px-2.5 py-1.5 text-xs", tone)}
    >
      {state.message}
      {state.status === "conflict" ? (
        <>
          {" "}
          It is now <strong>{state.ticket.status}</strong>, priority{" "}
          <strong>{state.ticket.priority}</strong>
          {state.ticket.assignee ? (
            <>
              , assigned to <strong>{state.ticket.assignee.name}</strong>
            </>
          ) : (
            ", unassigned"
          )}
          . Reload to continue from there.
        </>
      ) : null}
    </p>
  );
}

export function TicketControls({
  ticket,
  agents,
  allLabels,
  capabilities,
  currentAgentId,
}: Props) {
  const [optimistic, applyOptimistic] = useOptimistic(
    ticket,
    (current: TicketWithCustomer, patch: Patch) => ({ ...current, ...patch }),
  );

  const [statusState, submitStatus, statusPending] = useActionState(
    changeStatusAction,
    IDLE,
  );
  const [priorityState, submitPriority, priorityPending] = useActionState(
    changePriorityAction,
    IDLE,
  );
  const [assignState, submitAssign, assignPending] = useActionState(
    assignAction,
    IDLE,
  );
  const [labelState, submitLabel, labelPending] = useActionState(
    toggleLabelAction,
    IDLE,
  );

  const assignableAgents = capabilities.assignOthers
    ? agents
    : agents.filter((agent) => agent.id === currentAgentId);

  return (
    <div className="space-y-4">
      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-wide text-subtle uppercase">
            Status
          </h3>
          <StatusBadge status={optimistic.status} />
        </div>
        <form
          action={(formData) => {
            applyOptimistic({ status: formData.get("status") as TicketStatus });
            return submitStatus(formData);
          }}
          className="flex flex-wrap gap-1"
        >
          <input type="hidden" name="ticketId" value={ticket.id} />
          <input type="hidden" name="version" value={ticket.version} />
          {TICKET_STATUSES.map((status) => {
            const disallowed = status === "closed" && !capabilities.close;
            return (
              <Button
                key={status}
                type="submit"
                name="status"
                value={status}
                size="sm"
                variant={optimistic.status === status ? "primary" : "secondary"}
                disabled={
                  !capabilities.changeStatus || disallowed || statusPending
                }
                title={
                  disallowed ? "Closing a ticket requires a supervisor" : undefined
                }
              >
                {status}
              </Button>
            );
          })}
        </form>
        <div className="mt-1.5">
          <Feedback state={statusState} />
        </div>
      </section>

      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-wide text-subtle uppercase">
            Priority
          </h3>
          <PriorityBadge priority={optimistic.priority} />
        </div>
        <form
          action={(formData) => {
            applyOptimistic({
              priority: formData.get("priority") as TicketPriority,
            });
            return submitPriority(formData);
          }}
          className="flex flex-wrap gap-1"
        >
          <input type="hidden" name="ticketId" value={ticket.id} />
          <input type="hidden" name="version" value={ticket.version} />
          {TICKET_PRIORITIES.map((priority) => (
            <Button
              key={priority}
              type="submit"
              name="priority"
              value={priority}
              size="sm"
              variant={optimistic.priority === priority ? "primary" : "secondary"}
              disabled={!capabilities.changePriority || priorityPending}
            >
              {priority}
            </Button>
          ))}
        </form>
        <div className="mt-1.5">
          <Feedback state={priorityState} />
        </div>
      </section>

      <section>
        <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">
          Assignee
        </h3>
        <form
          action={(formData) => {
            const id = String(formData.get("assigneeId") ?? "");
            const next = agents.find((agent) => agent.id === id) ?? null;
            applyOptimistic({ assignee: next, assigneeId: next?.id ?? null });
            return submitAssign(formData);
          }}
          className="flex items-center gap-2"
        >
          <input type="hidden" name="ticketId" value={ticket.id} />
          <input type="hidden" name="version" value={ticket.version} />
          <label htmlFor="assignee-select" className="sr-only">
            Assign this ticket
          </label>
          <select
            id="assignee-select"
            name="assigneeId"
            defaultValue={optimistic.assigneeId ?? ""}
            disabled={!capabilities.assignSelf || assignPending}
            className="h-9 flex-1 rounded-(--radius-control) border border-line-strong bg-surface px-2 text-sm text-ink"
          >
            <option value="">Unassigned</option>
            {assignableAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.role})
              </option>
            ))}
          </select>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            loading={assignPending}
            disabled={!capabilities.assignSelf}
          >
            Apply
          </Button>
        </form>
        {!capabilities.assignOthers ? (
          <p className="mt-1 text-xs text-subtle">
            Your role can take this ticket or release it. Routing it to another
            agent needs a supervisor.
          </p>
        ) : null}
        <div className="mt-1.5">
          <Feedback state={assignState} />
        </div>
      </section>

      <section>
        <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">
          Labels
        </h3>
        <form
          action={(formData) => {
            const label = String(formData.get("label") ?? "");
            const next = optimistic.labels.includes(label)
              ? optimistic.labels.filter((item) => item !== label)
              : [...optimistic.labels, label];
            applyOptimistic({ labels: next });
            return submitLabel(formData);
          }}
          className="flex flex-wrap gap-1"
        >
          <input type="hidden" name="ticketId" value={ticket.id} />
          <input type="hidden" name="version" value={ticket.version} />
          {allLabels.map((label) => {
            const active = optimistic.labels.includes(label);
            return (
              <button
                key={label}
                type="submit"
                name="label"
                value={label}
                disabled={!capabilities.label || labelPending}
                aria-pressed={active}
                className="rounded-full disabled:opacity-60"
              >
                <Chip tone={active ? "accent" : "neutral"}>
                  {active ? "✓ " : "+ "}
                  {label}
                </Chip>
              </button>
            );
          })}
        </form>
        <div className="mt-1.5">
          <Feedback state={labelState} />
        </div>
      </section>
    </div>
  );
}
