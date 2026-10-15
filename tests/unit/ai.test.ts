import { describe, expect, it } from "vitest";

import { selectAiProvider } from "@/server/ai";
import { AnthropicAiProvider } from "@/server/ai/anthropic";
import { MockAiProvider, keywords, rankArticles } from "@/server/ai/mock";
import type { AiContext } from "@/server/ai/provider";
import type { KbArticle, Message, TicketWithCustomer } from "@/types/domain";

const ARTICLES: KbArticle[] = [
  {
    id: "a1",
    slug: "webhook-retries",
    title: "How webhook retries work",
    summary: "The retry schedule and how to stop a retry storm.",
    body: "Retries use exponential backoff. Acknowledge first, process afterwards.",
    tags: ["webhooks", "integration"],
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "a2",
    slug: "timezone-display",
    title: "Why timestamps show in UTC",
    summary: "Where the display timezone comes from.",
    body: "Timestamps are stored in UTC and converted for display.",
    tags: ["timezone", "settings"],
    updatedAt: "2026-10-02T00:00:00.000Z",
  },
];

const TICKET = {
  id: "tkt_0001",
  reference: "SF-1000",
  subject: "Webhook deliveries retrying forever",
  status: "open",
  priority: "high",
  channel: "email",
  customerId: "cus_001",
  assigneeId: "agt_rivera",
  labels: ["integration"],
  createdAt: "2026-10-10T09:00:00.000Z",
  updatedAt: "2026-10-12T09:00:00.000Z",
  version: 3,
  customer: {
    id: "cus_001",
    name: "Aiko Tanaka",
    email: "aiko.tanaka@northwind.example.com",
    company: "Northwind Logistics",
    plan: "enterprise",
    since: "2024-02-01T00:00:00.000Z",
  },
  assignee: {
    id: "agt_rivera",
    name: "Nadia Rivera",
    email: "nadia.rivera@example.com",
    role: "agent",
  },
  messageCount: 2,
  lastMessageAt: "2026-10-12T09:00:00.000Z",
  lastMessagePreview: "",
} satisfies TicketWithCustomer;

const MESSAGES: Message[] = [
  {
    id: "m1",
    ticketId: TICKET.id,
    authorKind: "customer",
    authorId: "cus_001",
    authorName: "Aiko Tanaka",
    body: "Webhook deliveries retrying forever\n\nOur endpoint keeps receiving the same webhook delivery every few minutes and the retries never stop.",
    internal: false,
    createdAt: "2026-10-10T09:00:00.000Z",
  },
  {
    id: "m2",
    ticketId: TICKET.id,
    authorKind: "agent",
    authorId: "agt_rivera",
    authorName: "Nadia Rivera",
    body: "Reproduced on staging — looks like the acknowledgement timing.",
    internal: true,
    createdAt: "2026-10-11T09:00:00.000Z",
  },
];

const CONTEXT: AiContext = {
  ticket: TICKET,
  messages: MESSAGES,
  articles: ARTICLES,
};

describe("keyword extraction", () => {
  it("drops stopwords and short words, ranking by frequency", () => {
    const terms = keywords(
      "The webhook deliveries keep retrying and the webhook endpoint is not acknowledging",
    );
    expect(terms[0]).toBe("webhook");
    expect(terms).not.toContain("the");
    expect(terms).not.toContain("and");
  });

  it("is deterministic for the same input", () => {
    const a = keywords("alpha beta alpha gamma");
    const b = keywords("alpha beta alpha gamma");
    expect(a).toEqual(b);
  });
});

describe("article ranking", () => {
  it("ranks the article whose vocabulary overlaps the ticket", () => {
    const ranked = rankArticles(keywords(MESSAGES[0]!.body), ARTICLES);
    expect(ranked[0]?.slug).toBe("webhook-retries");
  });

  it("returns nothing when nothing overlaps", () => {
    expect(rankArticles(["zzzzz", "qqqqq"], ARTICLES)).toEqual([]);
  });
});

describe("MockAiProvider", () => {
  const provider = new MockAiProvider();

  it("declares itself simulated", () => {
    expect(provider.simulated).toBe(true);
  });

  it("summarises using real facts from the ticket", async () => {
    const result = await provider.summarise(CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.output.text).toContain("Aiko Tanaka");
    expect(result.output.text).toContain("Northwind Logistics");
    expect(result.output.text).toContain("enterprise");
    expect(result.output.text).toContain("priority high");
    expect(result.output.text).toContain("Nadia Rivera");
    // One agent message, and it is an internal note.
    expect(result.output.text).toContain("1 internal note");
    expect(result.output.citations).toContain("webhook-retries");
    expect(result.simulated).toBe(true);
  });

  it("drafts a reply addressed to the customer and signed by the assignee", async () => {
    const result = await provider.draftReply(CONTEXT, "confirm the retry schedule");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.output.text.startsWith("Hi Aiko,")).toBe(true);
    expect(result.output.text).toContain("How webhook retries work");
    expect(result.output.text).toContain("confirm the retry schedule");
    expect(result.output.text).toContain("Nadia Rivera");
    // High priority gets the same-day commitment, not the next-day one.
    expect(result.output.text).toContain("today");
  });

  it("is deterministic — the same ticket produces the same draft", async () => {
    const first = await provider.draftReply(CONTEXT, "");
    const second = await provider.draftReply(CONTEXT, "");
    expect(first).toEqual(second);
  });

  it("degrades gracefully when there is nothing to work with", async () => {
    const result = await provider.summarise({
      ticket: TICKET,
      messages: [],
      articles: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.text).toContain("No customer message");
    expect(result.output.citations).toEqual([]);
  });
});

describe("provider selection", () => {
  it("uses the mock when no key is configured", () => {
    expect(selectAiProvider({})).toBeInstanceOf(MockAiProvider);
  });

  it("uses the mock when a key is present but mock mode is forced", () => {
    expect(
      selectAiProvider({
        ANTHROPIC_API_KEY: "sk-test",
        AI_PROVIDER: "mock",
      }),
    ).toBeInstanceOf(MockAiProvider);
  });

  it("uses the real provider only when a non-empty key is present", () => {
    expect(
      selectAiProvider({ ANTHROPIC_API_KEY: "   " }),
    ).toBeInstanceOf(MockAiProvider);
    expect(
      selectAiProvider({ ANTHROPIC_API_KEY: "sk-test" }),
    ).toBeInstanceOf(AnthropicAiProvider);
  });
});
