import type { KbArticle, Message, TicketWithCustomer } from "@/types/domain";

/**
 * AI provider abstraction.
 *
 * The application never imports a vendor SDK directly. It depends on this
 * interface, which has two implementations: a deterministic mock that runs
 * with no key and no network, and an Anthropic-backed one that is selected
 * only when `ANTHROPIC_API_KEY` is present.
 *
 * Three things this is designed to get right, because they are what separates
 * a usable AI feature from a decorative button:
 *
 * 1. **It works with no key.** The demo is fully functional in mock mode, and
 *    says so in the UI rather than pretending.
 * 2. **The key never reaches the browser.** The provider is only ever
 *    constructed inside a server action.
 * 3. **Failure is a first-class outcome.** Every call returns a result object
 *    rather than throwing, so a provider outage degrades to an explained
 *    message instead of a broken screen.
 */

export interface AiContext {
  ticket: TicketWithCustomer;
  messages: Message[];
  articles: KbArticle[];
}

export interface AiOutput {
  text: string;
  /** Short rationale shown to the agent so the suggestion is reviewable. */
  notes: string[];
  /** Knowledge-base slugs the answer leaned on. */
  citations: string[];
}

export type AiResult =
  | { ok: true; output: AiOutput; provider: string; simulated: boolean }
  | { ok: false; error: string; provider: string; simulated: boolean };

export interface AiProvider {
  readonly name: string;
  readonly simulated: boolean;
  summarise(context: AiContext): Promise<AiResult>;
  draftReply(context: AiContext, instruction: string): Promise<AiResult>;
}
