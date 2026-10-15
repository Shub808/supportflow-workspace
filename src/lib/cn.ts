export type ClassValue = string | number | null | undefined | false | ClassValue[];

/** Conditional class-name joiner. See docs/adr/0004-dependency-budget.md. */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  const walk = (value: ClassValue): void => {
    if (!value && value !== 0) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    out.push(String(value));
  };
  values.forEach(walk);
  return out.join(" ");
}
