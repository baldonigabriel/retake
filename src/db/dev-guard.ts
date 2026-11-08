/**
 * Guard for anything that writes fake data (e2e seed and cleanup, dev seeds).
 *
 * The check asks the database itself, not the .env files: a dev database is
 * marked once with
 *
 *   COMMENT ON DATABASE neondb IS 'retake:dev';
 *
 * and production never is. A copied or stale DATABASE_URL pointing at
 * production then fails here before any row is touched.
 */
import { sql } from "drizzle-orm";

import { db } from "@/db";

export const DEV_DATABASE_MARK = "retake:dev";

export class NotDevDatabaseError extends Error {
  constructor(found: string | null) {
    super(
      `Refusing to write test data: this database is not marked as dev (comment: ${found === null ? "none" : JSON.stringify(found)}). ` +
        `If this really is the dev database, run: COMMENT ON DATABASE <name> IS '${DEV_DATABASE_MARK}';`,
    );
    this.name = "NotDevDatabaseError";
  }
}

/** Throws unless the connected database carries the dev mark. */
export async function assertDevDatabase(): Promise<void> {
  const result = await db().execute<{ mark: string | null }>(
    sql`select shobj_description(oid, 'pg_database') as mark from pg_database where datname = current_database()`,
  );
  const mark = result.rows[0]?.mark ?? null;
  if (mark !== DEV_DATABASE_MARK) throw new NotDevDatabaseError(mark);
}
