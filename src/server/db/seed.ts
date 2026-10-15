import type { DatabaseSync } from "node:sqlite";

import {
  CHANNELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type Channel,
  type TicketPriority,
  type TicketStatus,
} from "@/types/domain";

/**
 * Deterministic demo data.
 *
 * Everything is generated from a fixed seed so the database is identical on
 * every start — which is what makes the integration and end-to-end tests able
 * to assert on specific tickets, and what makes a reviewer's screenshots match
 * mine. Every person, company and email address below is invented; no real
 * customer or employer data appears anywhere in this project.
 */

function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rng: () => number, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)]!;

export const SEED_AGENTS = [
  { id: "agt_rivera", name: "Nadia Rivera", email: "nadia.rivera@example.com", role: "agent" },
  { id: "agt_okafor", name: "Tunde Okafor", email: "tunde.okafor@example.com", role: "agent" },
  { id: "agt_lindqvist", name: "Mia Lindqvist", email: "mia.lindqvist@example.com", role: "supervisor" },
  { id: "agt_bhatt", name: "Rohan Bhatt", email: "rohan.bhatt@example.com", role: "admin" },
] as const;

const COMPANIES = [
  "Northwind Logistics", "Helix Biotech", "Cobalt Studios", "Atlas Freight",
  "Pinewood Retail", "Verdant Energy", "Harbor Analytics", "Kestrel Robotics",
  "Lumen Health", "Tidewater Media",
] as const;

const PEOPLE = [
  "Aiko Tanaka", "Bruno Ferraro", "Chidi Eze", "Dina Haugen", "Emre Yilmaz",
  "Farrah Siddiqui", "Gustav Bauer", "Hana Novak", "Idris Rahman", "Jana Petrov",
  "Karl Jansen", "Leila Moreau", "Marco Silva", "Nina Kowalski", "Oscar Vargas",
  "Priya Dasgupta", "Quentin Walsh", "Rosa Quintana", "Sven Eriksen", "Tara Byrne",
] as const;

const SUBJECTS = [
  "Export to CSV truncates rows after 10,000",
  "SSO login loop after password reset",
  "Webhook deliveries retrying forever",
  "Invoice shows the wrong billing period",
  "Bulk import rejects valid postcodes",
  "Dashboard charts blank on Safari 17",
  "API rate limit hit much earlier than documented",
  "Scheduled report never arrived",
  "Two-factor codes rejected on the mobile app",
  "Seat count did not update after upgrade",
  "Timezone shown as UTC instead of local",
  "Attachments over 5 MB fail silently",
  "Audit log missing yesterday's entries",
  "Search returns no results for exact IDs",
  "Account owner transfer is stuck pending",
] as const;

const CUSTOMER_OPENERS = [
  "We hit this on Tuesday and it is now blocking our month-end close. Could someone take a look today?",
  "This started after the last release. Nothing changed on our side as far as we can tell.",
  "I have attached the request ID from our logs. Happy to jump on a call if that is easier.",
  "Two of my colleagues can reproduce it as well, so it does not look like a local problem.",
  "Apologies if this is covered somewhere — I searched the docs and could not find anything.",
] as const;

const AGENT_REPLIES = [
  "Thanks for the detail — that request ID was exactly what I needed. I can reproduce it and I have raised it with engineering.",
  "I have applied a workaround on your account so you are unblocked while we ship the proper fix.",
  "Could you confirm which browser version you are on? I want to rule out a known rendering issue.",
  "This one is on us. The fix is in the release going out on Thursday; I will follow up once it is live.",
] as const;

const INTERNAL_NOTES = [
  "Third report of this today — flagging to the platform team.",
  "Enterprise plan, renewal in six weeks. Worth keeping the response time tight.",
  "Reproduced on staging. Looks like the pagination cursor, not the export itself.",
] as const;

const LABELS = [
  "billing", "bug", "integration", "onboarding", "performance",
  "regression", "security", "how-to",
] as const;

export const SEED_SAVED_REPLIES = [
  {
    id: "mac_ack",
    title: "Acknowledge and set expectations",
    body: "Thanks for getting in touch, and sorry for the trouble. I have your report and I am looking into it now. I will come back to you with an update within one business day, sooner if I find the cause before then.",
    tags: "general,first-response",
  },
  {
    id: "mac_repro",
    title: "Request reproduction details",
    body: "To get to the bottom of this quickly, could you send me:\n\n1. The exact time (with timezone) you last saw the problem\n2. The account or request ID shown in the error\n3. The browser and version, if it happens in the UI\n\nThat usually lets me reproduce it on our side straight away.",
    tags: "bug,triage",
  },
  {
    id: "mac_billing",
    title: "Billing period explanation",
    body: "Invoices are generated on the first day of the billing period and cover the period that follows, so the dates on the invoice run ahead of the usage it bills for. I have attached a breakdown of the line items so you can reconcile it against your records.",
    tags: "billing",
  },
  {
    id: "mac_resolved",
    title: "Confirm resolution",
    body: "The fix for this is now live and I have verified it against your account. I will leave this ticket open for a couple of days in case anything looks off — just reply here and it will come straight back to me.",
    tags: "closing",
  },
] as const;

export const SEED_ARTICLES = [
  {
    id: "kb_export_limits",
    slug: "export-limits",
    title: "Export limits and how to work around them",
    summary: "Why CSV exports cap at 10,000 rows, and the two supported ways to get a complete dataset.",
    body: "Exports generated from the UI are capped at 10,000 rows. The cap exists because the export is built synchronously inside the request, and a larger file risks a gateway timeout.\n\nThere are two supported ways to get a complete dataset:\n\n**Narrow the export.** Apply a date range or a status filter so each export stays under the cap, then concatenate the files. This is the quickest option for one-off reporting.\n\n**Use the reporting API.** The /v1/exports endpoint streams results and has no row limit. It returns a job ID; poll it until the status is 'ready', then download the signed URL. The URL is valid for one hour.\n\nIf an export silently returns fewer rows than you expect, check whether a filter is still applied — the export always matches the filtered view, not the whole table.",
    tags: "export,limits,api",
  },
  {
    id: "kb_sso_loop",
    slug: "sso-login-loop",
    title: "Fixing an SSO login loop",
    summary: "What causes the redirect loop after a password reset, and how to clear it.",
    body: "A login loop after a password reset almost always means the identity provider is still holding a session for the previous credentials.\n\n**First, clear the stale session.** Sign out of the identity provider directly, not just the application. Then open the application in a private window to confirm the loop is gone.\n\n**If it persists, check the clock.** SAML assertions are time-bound. A device clock more than five minutes out will have every assertion rejected, which presents as a loop rather than an error.\n\n**If it still persists**, an administrator can force a re-sync from Settings > Authentication > Re-sync directory. This invalidates every cached assertion for the account and takes about a minute.",
    tags: "sso,authentication,login",
  },
  {
    id: "kb_webhooks",
    slug: "webhook-retries",
    title: "How webhook retries work",
    summary: "The retry schedule, what counts as a successful delivery, and how to stop a retry storm.",
    body: "A delivery is successful when your endpoint returns any 2xx status within ten seconds. Anything else — a non-2xx status, a timeout, a TLS failure — is a failure and is retried.\n\nRetries use exponential backoff: 30 seconds, then 2 minutes, 10 minutes, 1 hour, 6 hours, and finally 24 hours. After the sixth failure the delivery is dropped and the endpoint is marked unhealthy.\n\nIf you are seeing deliveries retry indefinitely, the usual cause is an endpoint that returns 200 only after doing its work. Acknowledge first, process afterwards: return 200 immediately and queue the payload internally.\n\nTo stop an in-flight retry storm, disable the endpoint in Settings > Webhooks. Disabling cancels pending retries; it does not delete the delivery history.",
    tags: "webhooks,integration,api",
  },
  {
    id: "kb_rate_limits",
    slug: "api-rate-limits",
    title: "API rate limits explained",
    summary: "How the limit is calculated, why it can be hit earlier than expected, and what the headers mean.",
    body: "Rate limits are applied per account, not per API key, and they are calculated over a sliding sixty-second window rather than a fixed minute.\n\nThis is the usual reason a limit is hit 'early': a burst at the end of one wall-clock minute and another at the start of the next both fall inside the same sliding window.\n\nEvery response carries three headers: X-RateLimit-Limit, X-RateLimit-Remaining and X-RateLimit-Reset. Reset is a Unix timestamp for when the oldest request leaves the window.\n\nWhen you are limited you get a 429 and a Retry-After header. Respect it; retrying sooner extends the window rather than shortening it.",
    tags: "api,limits,performance",
  },
  {
    id: "kb_timezones",
    slug: "timezone-display",
    title: "Why timestamps show in UTC",
    summary: "Where the display timezone comes from and how to change it for an account or a single user.",
    body: "Timestamps are stored in UTC and converted for display. The conversion uses, in order: the individual user's timezone setting, then the account default, then UTC.\n\nIf everything is showing as UTC, the most likely cause is a user profile created through the API without a timezone field, which skips both of the first two steps.\n\nSet it per user in Profile > Preferences > Timezone, or for everyone in Settings > Account > Default timezone. Changing the account default does not overwrite users who have set their own.\n\nExports and the API always return UTC in ISO-8601, regardless of display settings. This is deliberate: an export whose timestamps depend on who downloaded it is not reproducible.",
    tags: "timezone,settings,how-to",
  },
] as const;

const DAY_MS = 86_400_000;

/** Idempotent: does nothing if the database already holds tickets. */
export function seedDatabase(db: DatabaseSync, seed = 20_261_015): void {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM tickets").get() as
    | { n: number }
    | undefined;
  if ((existing?.n ?? 0) > 0) return;

  const rng = createRng(seed);
  // A fixed "now" keeps relative timestamps stable across runs, so tests and
  // screenshots do not drift from one day to the next.
  const now = Date.parse("2026-10-15T09:00:00.000Z");
  const iso = (ms: number) => new Date(ms).toISOString();

  db.exec("BEGIN");
  try {
    const insertAgent = db.prepare(
      "INSERT INTO agents (id, name, email, role) VALUES (?, ?, ?, ?)",
    );
    for (const agent of SEED_AGENTS) {
      insertAgent.run(agent.id, agent.name, agent.email, agent.role);
    }

    const insertCustomer = db.prepare(
      "INSERT INTO customers (id, name, email, company, plan, since) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const customerIds: string[] = [];
    PEOPLE.forEach((name, index) => {
      const id = `cus_${String(index + 1).padStart(3, "0")}`;
      const company = COMPANIES[index % COMPANIES.length]!;
      const handle = name.toLowerCase().replace(/[^a-z]+/g, ".");
      insertCustomer.run(
        id,
        name,
        `${handle}@${company.toLowerCase().replace(/[^a-z]+/g, "")}.example.com`,
        company,
        pick(rng, ["free", "pro", "enterprise", "pro", "enterprise"] as const),
        iso(now - Math.floor(rng() * 900) * DAY_MS),
      );
      customerIds.push(id);
    });

    const insertTicket = db.prepare(
      `INSERT INTO tickets
         (id, reference, subject, status, priority, channel, customer_id, assignee_id, created_at, updated_at, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    );
    const insertLabel = db.prepare(
      "INSERT OR IGNORE INTO ticket_labels (ticket_id, label) VALUES (?, ?)",
    );
    const insertMessage = db.prepare(
      `INSERT INTO messages (id, ticket_id, author_kind, author_id, author_name, body, internal, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertEvent = db.prepare(
      `INSERT INTO ticket_events (id, ticket_id, actor_id, actor_name, kind, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    const TICKET_COUNT = 48;
    for (let i = 0; i < TICKET_COUNT; i += 1) {
      const id = `tkt_${String(i + 1).padStart(4, "0")}`;
      const reference = `SF-${1000 + i}`;
      const customerId = customerIds[i % customerIds.length]!;
      const customerName = PEOPLE[i % PEOPLE.length]!;
      const status: TicketStatus =
        i < 6 ? "new" : pick(rng, TICKET_STATUSES);
      const priority: TicketPriority = pick(rng, TICKET_PRIORITIES);
      const channel: Channel = pick(rng, CHANNELS);
      // Unassigned tickets are a real inbox state, so some are left null.
      const assignee =
        status === "new" && rng() < 0.7
          ? null
          : pick(rng, SEED_AGENTS).id;

      const createdAt = now - Math.floor(rng() * 21 * DAY_MS) - 3_600_000;
      let cursor = createdAt;

      insertTicket.run(
        id,
        reference,
        SUBJECTS[i % SUBJECTS.length]!,
        status,
        priority,
        channel,
        customerId,
        assignee,
        iso(createdAt),
        iso(createdAt),
      );
      insertEvent.run(
        `evt_${id}_0`,
        id,
        null,
        customerName,
        "created",
        `Ticket opened via ${channel}`,
        iso(createdAt),
      );

      const labelCount = 1 + Math.floor(rng() * 2);
      for (let l = 0; l < labelCount; l += 1) {
        insertLabel.run(id, pick(rng, LABELS));
      }

      insertMessage.run(
        `msg_${id}_0`,
        id,
        "customer",
        customerId,
        customerName,
        `${SUBJECTS[i % SUBJECTS.length]!}.\n\n${pick(rng, CUSTOMER_OPENERS)}`,
        0,
        iso(cursor),
      );

      const replies = status === "new" ? 0 : 1 + Math.floor(rng() * 3);
      for (let r = 0; r < replies; r += 1) {
        cursor += Math.floor(rng() * 8 + 1) * 3_600_000;
        const agent =
          SEED_AGENTS.find((a) => a.id === assignee) ?? SEED_AGENTS[0];
        const internal = rng() < 0.25;
        insertMessage.run(
          `msg_${id}_${r + 1}`,
          id,
          "agent",
          agent.id,
          agent.name,
          internal ? pick(rng, INTERNAL_NOTES) : pick(rng, AGENT_REPLIES),
          internal ? 1 : 0,
          iso(cursor),
        );
        insertEvent.run(
          `evt_${id}_${r + 1}`,
          id,
          agent.id,
          agent.name,
          internal ? "note_added" : "replied",
          internal ? "Added an internal note" : "Replied to the customer",
          iso(cursor),
        );
      }

      db.prepare("UPDATE tickets SET updated_at = ? WHERE id = ?").run(
        iso(cursor),
        id,
      );
    }

    const insertReply = db.prepare(
      "INSERT INTO saved_replies (id, title, body, tags) VALUES (?, ?, ?, ?)",
    );
    for (const macro of SEED_SAVED_REPLIES) {
      insertReply.run(macro.id, macro.title, macro.body, macro.tags);
    }

    const insertArticle = db.prepare(
      "INSERT INTO kb_articles (id, slug, title, summary, body, tags, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    SEED_ARTICLES.forEach((article, index) => {
      insertArticle.run(
        article.id,
        article.slug,
        article.title,
        article.summary,
        article.body,
        article.tags,
        iso(now - (index + 1) * 6 * DAY_MS),
      );
    });

    // Populate the external-content FTS index from the rows just inserted.
    db.exec(
      "INSERT INTO kb_fts(rowid, title, summary, body) SELECT rowid, title, summary, body FROM kb_articles",
    );

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
