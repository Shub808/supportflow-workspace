/**
 * Formatting helpers.
 *
 * Locale and time zone are pinned explicitly. Letting `Intl` fall back to the
 * runtime's locale means the server HTML and the client's first render
 * disagree, which React reports as a hydration mismatch.
 */

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const COUNT = new Intl.NumberFormat("en-GB");

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

export function formatCount(value: number): string {
  return COUNT.format(value);
}

/**
 * Relative age, computed against an explicit `now`.
 *
 * `now` is a parameter rather than `Date.now()` so the function is pure and
 * testable, and so a server-rendered value can be passed the same instant the
 * rest of the page used.
 */
export function relativeAge(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "unknown";
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return formatDate(iso);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
