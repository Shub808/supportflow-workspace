import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace-shell";
import { Chip, Panel } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import { currentAgent } from "@/server/auth/current-user";
import { getArticleBySlug } from "@/server/repo/knowledge";

export async function generateMetadata(
  props: PageProps<"/kb/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const article = getArticleBySlug(slug);
  return { title: article?.title ?? "Article" };
}

export default async function ArticlePage(props: PageProps<"/kb/[slug]">) {
  const { slug } = await props.params;
  const agent = (await currentAgent())!;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  return (
    <WorkspaceShell agent={agent} current="kb">
      <article className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/kb" className="text-xs text-muted hover:text-ink">
          ← Back to the knowledge base
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-ink">{article.title}</h1>
        <p className="mt-1 text-sm text-muted">{article.summary}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {article.tags.map((tag) => (
            <Chip key={tag}>{tag}</Chip>
          ))}
          <span className="tabular ml-auto text-xs text-subtle">
            Updated {formatDate(article.updatedAt)}
          </span>
        </div>

        <Panel className="mt-4 p-5">
          {/* Rendered as plain text blocks, not parsed markup. */}
          <div className="space-y-3">
            {article.body.split("\n\n").map((paragraph, index) => (
              <p key={index} className="message-body text-sm text-ink">
                {paragraph}
              </p>
            ))}
          </div>
        </Panel>
      </article>
    </WorkspaceShell>
  );
}
