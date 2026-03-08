import {
  RDSDataClient,
  ExecuteStatementCommand,
} from "@aws-sdk/client-rds-data";
import { readFileSync } from "fs";
import { config } from "dotenv";
import { join } from "path";

config({ path: join(__dirname, ".env.local") });

const client = new RDSDataClient({});

const CLUSTER_ARN = process.env.DB_CLUSTER_ARN!;
const SECRET_ARN = process.env.DB_SECRET_ARN!;
const DATABASE = process.env.DB_NAME!;

async function execute(sql: string) {
  await client.send(
    new ExecuteStatementCommand({
      resourceArn: CLUSTER_ARN,
      secretArn: SECRET_ARN,
      database: DATABASE,
      sql,
    }),
  );
}

async function main() {
  // Drop FK constraints that block inserts when user record doesn't exist yet
  const fixStatements = [
    `ALTER TABLE "photos" DROP CONSTRAINT IF EXISTS "photos_user_id_users_id_fk"`,
    `ALTER TABLE "albums" DROP CONSTRAINT IF EXISTS "albums_user_id_users_id_fk"`,
  ];

  console.log("Removing user FK constraints...");
  for (const sql of fixStatements) {
    console.log(`  → ${sql}`);
    try {
      await execute(sql);
    } catch {
      /* already gone */
    }
  }

  // Register the initial migration in drizzle's tracking table so
  // drizzle-kit migrate knows it has already been applied
  console.log("Registering migration in drizzle tracking table...");
  await execute(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await execute(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
  await execute(`
    INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
    SELECT '7a3efb565536ec964ffdf6b4c099db02e17ebfb6158b6719ae2cfdd7989205ec', 1772169940484
    WHERE NOT EXISTS (
      SELECT 1 FROM "drizzle"."__drizzle_migrations"
      WHERE hash = '7a3efb565536ec964ffdf6b4c099db02e17ebfb6158b6719ae2cfdd7989205ec'
    )
  `);
  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
