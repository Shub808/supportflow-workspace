import type {
  AiContext,
  AiOutput,
  AiProvider,
  AiResult,
} from "@/server/ai/provider";
import type { KbArticle, Message } from "@/types/domain";

/**
 * Deterministic, offline provider.
 *
 * This is not a stub that returns lorem ipsum. It does real extractive work
 * over the actual ticket — pulls the customer's own wording, counts the
 * exchange, scores knowledge-base articles against the ticket's vocabulary —
 * so the feature is genuinely useful without a key, and so its output can be
 * asserted in tests.
 *
 * It is labelled as simulated everywhere it surfaces. Passing templated text
 * off as a model response would be the dishonest version of this.
 */

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "has", "our",
  "your", "you", "are", "was", "were", "not", "but", "can", "could", "would",
  "will", "there", "they", "them", "its", "it's", "a", "an", "to", "of", "in",
  "on", "is", "be", "at", "as", "we", "i", "my", "me", "do", "does", "did",
  "if", "so", "it", "any", "all", "when", "what", "how", "why",
]);

export function keywords(text: string, limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 4 || STOPWORDS.has(raw)) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

/** Overlap between the ticket's vocabulary and each article's. */
export function rankArticles(
  terms: string[],
  articles: KbArticle[],
  limit = 2,
): KbArticle[] {
  const wanted = new Set(terms);
  return articles
    .map((article) => {
      const haystack = `${article.title} ${article.summary} ${article.tags.join(" ")}`;
      const score = keywords(haystack, 40).filter((word) => wanted.has(word)).length;
      return { article, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.article);
}

function firstSentences(text: string, count: number): string {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  return sentences.slice(0, count).join(" ").trim();
}

function customerMessages(messages: Message[]): Message[] {
  return messages.filter((message) => message.authorKind === "customer");
}

function build(context: AiContext): {
  terms: string[];
  related: KbArticle[];
  opener: Message | undefined;
} {
  const fromCustomer = customerMessages(context.messages);
  const corpus = `${context.ticket.subject} ${fromCustomer.map((m) => m.body).join(" ")}`;
  const terms = keywords(corpus);
  return {
    terms,
    related: rankArticles(terms, context.articles),
    opener: fromCustomer[0],
  };
}

export class MockAiProvider implements AiProvider {
  readonly name = "deterministic-mock";
  readonly simulated = true;

  async summarise(context: AiContext): Promise<AiResult> {
    const { terms, related, opener } = build(context);
    const replies = context.messages.filter((m) => m.authorKind === "agent" && !m.internal);
    const notes = context.messages.filter((m) => m.internal);

    const lines = [
      // Plain text, not Markdown: the panel renders the string as-is (no
      // markup parsing anywhere in this app), so asterisks would just show up
      // as asterisks.
      `${context.ticket.customer.name} (${context.ticket.customer.company}, ${context.ticket.customer.plan} plan) reported: ${context.ticket.subject}.`,
      opener
        ? `In their own words: "${firstSentences(opener.body.split("\n").slice(1).join(" ") || opener.body, 1)}"`
        : "No customer message is recorded on this ticket yet.",
      `The thread has ${context.messages.length} message${context.messages.length === 1 ? "" : "s"}: ${replies.length} agent repl${replies.length === 1 ? "y" : "ies"} and ${notes.length} internal note${notes.length === 1 ? "" : "s"}.`,
      `Current state: ${context.ticket.status}, priority ${context.ticket.priority}, ${context.ticket.assignee ? `assigned to ${context.ticket.assignee.name}` : "unassigned"}.`,
    ];

    if (related.length > 0) {
      lines.push(
        `Likely relevant: ${related.map((a) => `"${a.title}"`).join(" and ")}.`,
      );
    }

    const output: AiOutput = {
      text: lines.join("\n\n"),
      notes: [
        `Key terms: ${terms.slice(0, 5).join(", ") || "none extracted"}`,
        related.length > 0
          ? "Knowledge-base matches ranked by term overlap with the ticket."
          : "No knowledge-base article overlapped this ticket's vocabulary.",
      ],
      citations: related.map((a) => a.slug),
    };

    return { ok: true, output, provider: this.name, simulated: true };
  }

  async draftReply(context: AiContext, instruction: string): Promise<AiResult> {
    const { related, opener } = build(context);
    const first = context.ticket.customer.name.split(" ")[0] ?? "there";

    const paragraphs = [
      `Hi ${first},`,
      opener
        ? `Thanks for flagging this, and sorry for the disruption. To confirm I have understood: ${firstSentences(
            opener.body.split("\n").slice(1).join(" ") || opener.body,
            1,
          ).replace(/^"|"$/g, "")}`
        : "Thanks for getting in touch.",
    ];

    if (related.length > 0) {
      const article = related[0]!;
      paragraphs.push(
        `This looks like the behaviour described in "${article.title}". ${firstSentences(article.body, 2)}`,
      );
    }

    if (instruction.trim().length > 0) {
      paragraphs.push(
        `I have also noted your request to ${instruction.trim().replace(/\.$/, "")}, and will cover that in my next update.`,
      );
    }

    paragraphs.push(
      context.ticket.priority === "urgent" || context.ticket.priority === "high"
        ? "I have prioritised this and will come back to you today with either a fix or a workaround."
        : "I will come back to you with an update within one business day.",
      `Best regards,\n${context.ticket.assignee?.name ?? "The support team"}`,
    );

    return {
      ok: true,
      provider: this.name,
      simulated: true,
      output: {
        text: paragraphs.join("\n\n"),
        notes: [
          "Drafted offline from the ticket's own text — review before sending.",
          related.length > 0
            ? `Leaned on ${related.length} knowledge-base article${related.length === 1 ? "" : "s"}.`
            : "No knowledge-base article matched; the draft is generic.",
        ],
        citations: related.map((a) => a.slug),
      },
    };
  }
}
