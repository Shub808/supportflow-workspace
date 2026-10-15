import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";

import { WorkspaceShell } from "@/components/workspace-shell";
import { Chip, EmptyState, Panel } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import { currentAgent } from "@/server/auth/current-user";
import { searchArticles } from "@/server/repo/knowledge";

export const metadata: Metadata = { title: "Knowledge base" };

/**
 * Knowledge base search.
 *
 * Backed by SQLite FTS5 with porter stemming, so "refunding" finds an article
 * about refunds and "webhooks retry" matches "webhook retries". User input is
 * escaped into a quoted AND expression before it reaches FTS5 — raw input
 * would be interpreted as FTS query syntax (`NEAR`, `*`, `-`, `"`), which
 * either errors or silently runs a query nobody asked for.
 */
export default async function KnowledgeBasePage(props: PageProps<"/kb">) {
  const agent = (await currentAgent())!;
  const params = await props.searchParams;
  const raw = params.q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 120) ?? "";
  const articles = searchArticles(q || null);

  return (
    <WorkspaceShell agent={agent} current="kb">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-base font-semibold text-ink">Knowledge base</h1>
        <p className="mt-1 text-xs text-muted">
          Full-text search with stemming — searching “refunding” finds articles
          about refunds.
        </p>

        <form action="/kb" method="get" role="search" className="mt-4">
          <label htmlFor="kb-search" className="sr-only">
            Search the knowledge base
          </label>
          <input
            id="kb-search"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search articles"
            className="h-10 w-full rounded-(--radius-control) border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-subtle"
          />
        </form>

        <p className="mt-3 text-xs text-subtle" aria-live="polite">
          {q
            ? `${articles.length} article${articles.length === 1 ? "" : "s"} matching “${q}”`
            : `${articles.length} articles`}
        </p>

        {articles.length === 0 ? (
          <Panel className="mt-3">
            <EmptyState
              title="Nothing matched that search"
              description="Try a single keyword — the index stems words, so the root form usually works best."
            />
          </Panel>
        ) : (
          <ul className="mt-3 space-y-3">
            {articles.map((article) => (
              <li key={article.id}>
                <Panel className="p-4">
                  <Link
                    href={`/kb/${article.slug}` as Route}
                    className="text-sm font-medium text-ink hover:underline"
                  >
                    {article.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted">{article.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {article.tags.map((tag) => (
                      <Chip key={tag}>{tag}</Chip>
                    ))}
                    <span className="tabular ml-auto text-xs text-subtle">
                      Updated {formatDate(article.updatedAt)}
                    </span>
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </div>
    </WorkspaceShell>
  );
}
