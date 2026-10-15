"use client";

import { useActionState, useRef, useState } from "react";

import { aiAssistAction, replyAction } from "@/server/actions/tickets";
import { AI_IDLE, IDLE } from "@/server/actions/result";
import { Button, Chip } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { TICKET_STATUSES, type SavedReply, type TicketWithCustomer } from "@/types/domain";

/**
 * Reply composer.
 *
 * Three things are deliberately joined here because they are one decision for
 * the agent: what to say, whether it is public or an internal note, and what
 * the ticket's status becomes. The server applies the reply and the status
 * transition in a single transaction, so a sent reply can never be recorded
 * against a ticket whose status failed to move.
 */
export function Composer({
  ticket,
  savedReplies,
  canReply,
  canNote,
  canClose,
}: {
  ticket: TicketWithCustomer;
  savedReplies: SavedReply[];
  canReply: boolean;
  canNote: boolean;
  canClose: boolean;
}) {
  const [state, submit, pending] = useActionState(replyAction, IDLE);
  const [ai, runAi, aiPending] = useActionState(aiAssistAction, AI_IDLE);
  const [internal, setInternal] = useState(false);
  const [instruction, setInstruction] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  /** Inserts text at the caret rather than replacing the whole draft. */
  function insert(text: string) {
    const field = bodyRef.current;
    if (!field) return;
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? field.value.length;
    const next = `${field.value.slice(0, start)}${text}${field.value.slice(end)}`;
    field.value = next;
    field.focus();
    field.setSelectionRange(start + text.length, start + text.length);
  }

  const bodyError = state.status === "invalid" ? state.errors.body : undefined;

  return (
    <div className="border-t border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <div
          role="radiogroup"
          aria-label="Reply visibility"
          className="flex rounded-(--radius-control) border border-line p-0.5"
        >
          <button
            type="button"
            role="radio"
            aria-checked={!internal}
            onClick={() => setInternal(false)}
            disabled={!canReply}
            className={cn(
              "rounded-sm px-2.5 py-1 text-xs",
              !internal ? "bg-accent-600 font-medium text-white" : "text-muted",
            )}
          >
            Reply to customer
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={internal}
            onClick={() => setInternal(true)}
            disabled={!canNote}
            className={cn(
              "rounded-sm px-2.5 py-1 text-xs",
              internal ? "bg-accent-600 font-medium text-white" : "text-muted",
            )}
          >
            Internal note
          </button>
        </div>

        {savedReplies.length > 0 ? (
          <>
            <label htmlFor="saved-reply" className="sr-only">
              Insert a saved reply
            </label>
            <select
              id="saved-reply"
              defaultValue=""
              onChange={(event) => {
                const macro = savedReplies.find(
                  (item) => item.id === event.target.value,
                );
                if (macro) insert(macro.body);
                event.target.value = "";
              }}
              className="h-8 rounded-(--radius-control) border border-line-strong bg-surface px-2 text-xs text-ink"
            >
              <option value="">Insert saved reply…</option>
              {savedReplies.map((macro) => (
                <option key={macro.id} value={macro.id}>
                  {macro.title}
                </option>
              ))}
            </select>
          </>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
          <label htmlFor="ai-instruction" className="sr-only">
            Optional instruction for the assistant
          </label>
          <input
            id="ai-instruction"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Optional instruction for the assistant"
            className="h-8 w-56 rounded-(--radius-control) border border-line-strong bg-surface px-2 text-xs text-ink placeholder:text-subtle"
          />
          <form action={runAi} className="flex items-center gap-1.5">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <input type="hidden" name="instruction" value={instruction} />
            <Button
              type="submit"
              name="mode"
              value="summarise"
              size="sm"
              variant="secondary"
              disabled={aiPending}
            >
              Summarise
            </Button>
            <Button
              type="submit"
              name="mode"
              value="draft"
              size="sm"
              variant="secondary"
              loading={aiPending}
            >
              Draft reply
            </Button>
          </form>
        </div>
      </div>

      {ai.status !== "idle" ? (
        <div
          className={cn(
            "mx-4 mt-3 rounded-(--radius-control) border p-3",
            ai.status === "error"
              ? "border-chip-bad-br bg-chip-bad-bg"
              : "border-line bg-surface-muted",
          )}
        >
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-semibold text-ink">Assistant</h3>
            {/* The provider is always named. Passing templated text off as a
                model response would be the dishonest version of this feature. */}
            <Chip tone={ai.simulated ? "warn" : "info"}>
              {ai.simulated
                ? "Simulated — no API key configured"
                : `Live · ${ai.provider}`}
            </Chip>
          </div>

          {ai.status === "error" ? (
            <p role="alert" className="text-xs text-chip-bad-fg">
              {ai.message}
            </p>
          ) : (
            <>
              <p className="message-body text-xs text-ink">{ai.text}</p>
              {ai.notes.length > 0 ? (
                <ul className="mt-2 space-y-0.5 text-xs text-subtle">
                  {ai.notes.map((note) => (
                    <li key={note}>· {note}</li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => insert(ai.text)}>
                  Insert into reply
                </Button>
                {ai.citations.length > 0 ? (
                  <span className="text-xs text-subtle">
                    Referenced: {ai.citations.join(", ")}
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}

      <form action={submit} className="space-y-2 p-4">
        <input type="hidden" name="ticketId" value={ticket.id} />
        <input type="hidden" name="version" value={ticket.version} />
        <input
          type="hidden"
          name="internal"
          value={internal ? "on" : "off"}
        />

        <label htmlFor="reply-body" className="sr-only">
          {internal ? "Internal note" : "Reply to the customer"}
        </label>
        <textarea
          id="reply-body"
          ref={bodyRef}
          name="body"
          rows={5}
          required
          minLength={10}
          aria-invalid={bodyError ? true : undefined}
          aria-describedby={bodyError ? "reply-body-error" : undefined}
          placeholder={
            internal
              ? "Visible to your team only — context, next steps, who to loop in."
              : "Write your reply. The customer will receive this."
          }
          className={cn(
            "w-full rounded-(--radius-control) border bg-surface p-2.5 text-sm text-ink placeholder:text-subtle",
            bodyError ? "border-chip-bad-br" : "border-line-strong",
          )}
        />
        {bodyError ? (
          <p id="reply-body-error" role="alert" className="text-xs text-chip-bad-fg">
            {bodyError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="next-status" className="text-xs text-muted">
            Then set status to
          </label>
          <select
            id="next-status"
            name="nextStatus"
            defaultValue=""
            className="h-8 rounded-(--radius-control) border border-line-strong bg-surface px-2 text-xs text-ink"
          >
            <option value="">Leave unchanged</option>
            {TICKET_STATUSES.filter(
              (status) => status !== "closed" || canClose,
            ).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <Button
            type="submit"
            variant="primary"
            loading={pending}
            disabled={internal ? !canNote : !canReply}
            className="ml-auto"
          >
            {internal ? "Add internal note" : "Send reply"}
          </Button>
        </div>

        {state.status !== "idle" && state.status !== "invalid" ? (
          <p
            role={state.status === "success" ? "status" : "alert"}
            className={cn(
              "rounded-(--radius-control) border px-2.5 py-1.5 text-xs",
              state.status === "success"
                ? "border-chip-good-br bg-chip-good-bg text-chip-good-fg"
                : state.status === "conflict"
                  ? "border-chip-warn-br bg-chip-warn-bg text-chip-warn-fg"
                  : "border-chip-bad-br bg-chip-bad-bg text-chip-bad-fg",
            )}
          >
            {state.message}
          </p>
        ) : null}
        {state.status === "invalid" && !bodyError ? (
          <p role="alert" className="text-xs text-chip-bad-fg">
            {state.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
