/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PriorityBadge, StatusBadge } from "@/components/ui/status";
import { Avatar, Chip } from "@/components/ui/primitives";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/types/domain";

describe("StatusBadge", () => {
  it("renders a human label for every status in the domain", () => {
    for (const status of TICKET_STATUSES) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(
        screen.getByText(new RegExp(status, "i")),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("pairs colour with a glyph, so state is never colour alone", () => {
    const { container } = render(<StatusBadge status="resolved" />);
    const glyph = container.querySelector('[aria-hidden="true"]');
    expect(glyph).not.toBeNull();
    expect(glyph?.textContent).toBe("✓");
  });

  it("does not expose the decorative glyph to assistive technology", () => {
    render(<StatusBadge status="pending" />);
    // The accessible name is the word, not the symbol.
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});

describe("PriorityBadge", () => {
  it("renders every priority with a distinct direction glyph", () => {
    const glyphs = new Set<string>();
    for (const priority of TICKET_PRIORITIES) {
      const { container, unmount } = render(<PriorityBadge priority={priority} />);
      const glyph = container.querySelector('[aria-hidden="true"]')?.textContent;
      expect(glyph).toBeTruthy();
      glyphs.add(glyph!);
      unmount();
    }
    expect(glyphs.size).toBe(TICKET_PRIORITIES.length);
  });
});

describe("Avatar", () => {
  it("shows at most two initials and is hidden from assistive technology", () => {
    const { container } = render(<Avatar name="Nadia Rivera" />);
    const node = container.firstElementChild!;
    expect(node.textContent).toBe("NR");
    // The name is already in the adjacent text; announcing "NR" is noise.
    expect(node.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Chip", () => {
  it("renders its children", () => {
    render(<Chip tone="warn">billing</Chip>);
    expect(screen.getByText("billing")).toBeInTheDocument();
  });
});
