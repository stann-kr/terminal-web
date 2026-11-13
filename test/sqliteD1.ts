import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * A real SQLite built from every migration, for SQL whose conditions and batch order matter more
 * than its text. node:sqlite stands in for D1: a batch runs its statements in order inside one
 * transaction.
 */
export type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): { all(...values: unknown[]): unknown[]; run(...values: unknown[]): { changes: number | bigint } };
};
let DatabaseSync: (new (file: string) => SqliteDatabase) | undefined;
try {
  ({ DatabaseSync } = createRequire(import.meta.url)('node:sqlite'));
} catch {
  DatabaseSync = undefined;
}

/** False on a Node without node:sqlite; suites skip then. */
export const sqliteAvailable = DatabaseSync !== undefined;

const MIGRATIONS = path.join(__dirname, '..', 'migrations');

export function migratedSqlite(): SqliteDatabase {
  const sqlite = new DatabaseSync!(':memory:');
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()) {
    for (const sql of readFileSync(path.join(MIGRATIONS, file), 'utf8').split('--> statement-breakpoint')) {
      if (sql.trim()) sqlite.exec(sql);
    }
  }
  return sqlite;
}

export function d1(sqlite: SqliteDatabase) {
  const statement = (sql: string, values: unknown[] = []) => ({
    sql,
    values,
    bind: (...next: unknown[]) => statement(sql, next),
  });
  const run = ({ sql, values }: { sql: string; values: unknown[] }) => {
    const prepared = sqlite.prepare(sql);
    if (/^\s*(SELECT|WITH)/i.test(sql)) return { success: true, meta: { changes: 0 }, results: prepared.all(...values) };
    return { success: true, meta: { changes: Number(prepared.run(...values).changes) }, results: [] };
  };
  return {
    prepare: (sql: string) => statement(sql),
    async batch(statements: { sql: string; values: unknown[] }[]) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(run);
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as Pick<D1Database, 'prepare' | 'batch'>;
}
