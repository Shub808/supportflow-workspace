import type { DatabaseSync } from "node:sqlite";

import { getDb } from "@/server/db";
import type { KbArticle, SavedReply } from "@/types/domain";

/** Knowledge base and saved replies. */

type Row = Record<string, unknown>;
const str = (row: Row, key: string): string => String(row[key] ?? "");

function toArticle(row: Row): KbArticle {
  const tags = str(row, "tags");
  return {
    id: str(row, "id"),
    slug: str(row, "slug"),
    title: str(row, "title"),
    summary: str(row, "summary"),
    body: str(row, "body"),
    tags: tags ? tags.split(",").filter(Boolean) : [],
    updatedAt: str(row, "updated_at"),
  };
}

/**
 * Escapes a user's search terms for FTS5.
 *
 * FTS5 has its own query syntax — `NEAR`, `*`, `"`, `-`, `:` and `^` all mean
 * something — so passing raw user input through produces either a syntax
 * error or a query the user did not ask for. Each word is quoted and the
 * words are ANDed, which is what a user means by typing two words.
 */
export function toFtsQuery(input: string): string | null {
  const terms = input
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((term) => term.length > 1);
  if (terms.length === 0) return null;
  return terms.map((term) => `"${term}"`).join(" AND ");
}

export function searchArticles(
  query: string | null,
  db: DatabaseSync = getDb(),
): KbArticle[] {
  if (!query || query.trim() === "") {
    const rows = db
      .prepare("SELECT * FROM kb_articles ORDER BY updated_at DESC")
      .all() as Row[];
    return rows.map(toArticle);
  }

  const fts = toFtsQuery(query);
  if (!fts) return [];

  try {
    const rows = db
      .prepare(
        `SELECT a.* FROM kb_fts f
         JOIN kb_articles a ON a.rowid = f.rowid
         WHERE kb_fts MATCH ?
         ORDER BY bm25(kb_fts, 10.0, 5.0, 1.0)`,
      )
      .all(fts) as Row[];
    return rows.map(toArticle);
  } catch {
    // A malformed FTS expression must degrade to "no results", never a 500.
    return [];
  }
}

export function getArticleBySlug(
  slug: string,
  db: DatabaseSync = getDb(),
): KbArticle | null {
  const row = db
    .prepare("SELECT * FROM kb_articles WHERE slug = ?")
    .get(slug) as Row | undefined;
  return row ? toArticle(row) : null;
}

export function listSavedReplies(db: DatabaseSync = getDb()): SavedReply[] {
  const rows = db
    .prepare("SELECT * FROM saved_replies ORDER BY title")
    .all() as Row[];
  return rows.map((row) => {
    const tags = str(row, "tags");
    return {
      id: str(row, "id"),
      title: str(row, "title"),
      body: str(row, "body"),
      tags: tags ? tags.split(",").filter(Boolean) : [],
    };
  });
}
