import { Chip, type Tone } from "@/components/ui/primitives";
import type { TicketPriority, TicketStatus } from "@/types/domain";

/**
 * Status and priority badges.
 *
 * Each carries a glyph as well as a colour, so state survives greyscale
 * printing, colour-vision deficiency and forced-colors mode. Colour alone is
 * never the signal.
 */

const STATUS_TONE: Record<TicketStatus, Tone> = {
  new: "info",
  open: "accent",
  pending: "warn",
  resolved: "good",
  closed: "neutral",
};

const STATUS_GLYPH: Record<TicketStatus, string> = {
  new: "●",
  open: "◐",
  pending: "◌",
  resolved: "✓",
  closed: "□",
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  new: "New",
  open: "Open",
  pending: "Pending",
  resolved: "Resolved",
  closed: "Closed",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Chip
      tone={STATUS_TONE[status]}
      icon={<span aria-hidden="true">{STATUS_GLYPH[status]}</span>}
    >
      {STATUS_LABEL[status]}
    </Chip>
  );
}

const PRIORITY_TONE: Record<TicketPriority, Tone> = {
  low: "neutral",
  normal: "info",
  high: "warn",
  urgent: "bad",
};

const PRIORITY_GLYPH: Record<TicketPriority, string> = {
  low: "↓",
  normal: "→",
  high: "↑",
  urgent: "⇈",
};

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <Chip
      tone={PRIORITY_TONE[priority]}
      icon={<span aria-hidden="true">{PRIORITY_GLYPH[priority]}</span>}
    >
      {PRIORITY_LABEL[priority]}
    </Chip>
  );
}

export { STATUS_LABEL, PRIORITY_LABEL };
