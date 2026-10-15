import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { seedDatabase } from "@/server/db/seed";

/**
 * Database handle.
 *
 * SQLite via Node's built-in `node:sqlite` — no native build step, no
 * external service, no connection pool to misconfigure, and a real SQL
 * database with transactions and constraints rather than an array pretending
 * to be one. See docs/adr/0001-sqlite-via-node.md.
 *
 * `SUPPORTFLOW_DB_FILE` points at a file for a durable database. With it
 * unset the database lives in memory and is re-seeded on every process start,
 * which is what makes the public demo safe to poke at: anyone can change
 * anything, and a restart puts it back.
 */

let database: DatabaseSync | null = null;

function applySchema(db: DatabaseSync): void {
  const schemaPath = join(process.cwd(), "src", "server", "db", "schema.sql");
  db.exec(readFileSync(schemaPath, "utf8"));
}

export function getDb(): DatabaseSync {
  if (database) return database;

  const file = process.env.SUPPORTFLOW_DB_FILE?.trim();
  const db = new DatabaseSync(file && file.length > 0 ? file : ":memory:");
  applySchema(db);

  // Seeding is idempotent: it is a no-op once the tickets table has rows, so
  // a file-backed database keeps whatever the user did to it.
  seedDatabase(db);

  database = db;
  return db;
}

/** Test helper: a fresh, isolated, fully seeded in-memory database. */
export function createTestDb(seed = true): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  applySchema(db);
  if (seed) seedDatabase(db);
  return db;
}

/** Test helper: point module-level consumers at a specific database. */
export function setDbForTests(db: DatabaseSync | null): void {
  database = db;
}
