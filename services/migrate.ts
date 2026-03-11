/**
 * Migration runner using AWS RDS Data API directly.
 * drizzle-kit migrate with aws-data-api silently does nothing — use this instead.
 *
 * Usage:
 *   cd services && npx tsx migrate.ts
 *
 * Requires .env.local with DB_CLUSTER_ARN, DB_SECRET_ARN, DB_NAME
 * Requires valid AWS credentials in the environment.
 */
import { RDSDataClient, ExecuteStatementCommand } from "@aws-sdk/client-rds-data";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { config } from "dotenv";

config({ path: join(__dirname, ".env.local") });

const client = new RDSDataClient({});
const resourceArn = process.env.DB_CLUSTER_ARN!;
const secretArn = process.env.DB_SECRET_ARN!;
const database = process.env.DB_NAME!;

async function execute(sql: string): Promise<void> {
  await client.send(
    new ExecuteStatementCommand({ resourceArn, secretArn, database, sql }),
  );
}

async function query<T = Record<string, string>>(statement: string): Promise<T[]> {
  const res = await client.send(
    new ExecuteStatementCommand({
      resourceArn,
      secretArn,
      database,
      sql: statement,
      includeResultMetadata: true,
    }),
  );
  const cols = res.columnMetadata?.map((c) => c.name!) ?? [];
  return (res.records ?? []).map((row) => {
    const obj: Record<string, string> = {};
    row.forEach((cell, i) => { obj[cols[i]] = Object.values(cell)[0] as string; });
    return obj as T;
  }) as T[];
}

async function ensureMigrationsTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS __migrations (
      id serial PRIMARY KEY,
      name varchar(255) NOT NULL UNIQUE,
      applied_at timestamp DEFAULT now()
    )
  `);
}

async function getApplied(): Promise<Set<string>> {
  const rows = await query<{ name: string }>("SELECT name FROM __migrations");
  return new Set(rows.map((r) => r.name));
}

async function markApplied(name: string): Promise<void> {
  await execute(`INSERT INTO __migrations (name) VALUES ('${name}') ON CONFLICT DO NOTHING`);
}

async function main(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getApplied();

  const migrationsDir = join(__dirname, "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  skip  ${file}`);
      continue;
    }

    console.log(`  apply ${file}...`);
    const content = readFileSync(join(migrationsDir, file), "utf-8");

    // Split on drizzle's statement-breakpoint markers
    const statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await execute(statement);
    }

    await markApplied(file);
    ran++;
  }

  if (ran === 0) {
    console.log("\nNo new migrations.");
  } else {
    console.log(`\n✓ Applied ${ran} migration${ran !== 1 ? "s" : ""}.`);
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
