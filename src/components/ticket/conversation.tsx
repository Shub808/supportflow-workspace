import { Avatar, Chip } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatDateTime, relativeAge } from "@/lib/format";
import type { Message, TicketEvent } from "@/types/domain";

/**
 * The conversation thread.
 *
 * Message bodies are rendered as plain text inside a `white-space: pre-wrap`
 * block. Nothing here parses or injects markup: customer-supplied content is
 * the textbook XSS vector in a support tool, so React's default escaping is
 * left to do its job and `dangerouslySetInnerHTML` appears nowhere in this
 * codebase.
 */
export function Conversation({
  messages,
  events,
  now,
}: {
  messages: Message[];
  events: TicketEvent[];
  now: number;
}) {
  return (
    <div className="space-y-4 px-4 py-4">
      <ol aria-label="Conversation" className="space-y-4">
        {messages.map((message) => {
          const fromCustomer = message.authorKind === "customer";
          return (
            <li
              key={message.id}
              className={cn(
                "rounded-(--radius-panel) border p-3",
                message.internal
                  ? "border-chip-warn-br bg-chip-warn-bg"
                  : fromCustomer
                    ? "border-line bg-surface-muted"
                    : "border-line bg-surface",
              )}
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <Avatar name={message.authorName} />
                <span className="text-sm font-medium text-ink">
                  {message.authorName}
                </span>
                <Chip tone={fromCustomer ? "neutral" : "info"}>
                  {fromCustomer ? "Customer" : "Agent"}
                </Chip>
                {message.internal ? (
                  <Chip tone="warn" icon={<span aria-hidden="true">🔒</span>}>
                    Internal note — not sent to the customer
                  </Chip>
                ) : null}
                <time
                  dateTime={message.createdAt}
                  title={formatDateTime(message.createdAt)}
                  className="tabular ml-auto text-xs text-subtle"
                >
                  {relativeAge(message.createdAt, now)}
                </time>
              </div>
              <p
                className={cn(
                  "message-body text-sm",
                  message.internal ? "text-chip-warn-fg" : "text-ink",
                )}
              >
                {message.body}
              </p>
            </li>
          );
        })}
      </ol>

      <details className="rounded-(--radius-panel) border border-line bg-surface">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted">
          Activity log ({events.length})
        </summary>
        <ol aria-label="Activity log" className="space-y-1 border-t border-line px-3 py-2">
          {events.map((event) => (
            <li key={event.id} className="flex gap-2 text-xs text-subtle">
              <time
                dateTime={event.createdAt}
                className="tabular shrink-0"
                title={formatDateTime(event.createdAt)}
              >
                {relativeAge(event.createdAt, now)}
              </time>
              <span className="text-muted">
                <strong className="font-medium text-ink">{event.actorName}</strong>{" "}
                — {event.detail}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
