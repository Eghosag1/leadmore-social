import { readFileSync } from "fs";
import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const file = process.argv[2];
if (!file) {
  console.error("Usage: npx tsx scripts/run-migration.ts supabase/migrations/000X_name.sql");
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set in .env.local");
  process.exit(1);
}

async function main() {
  const sql = readFileSync(file, "utf-8");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    console.log(`Running ${file}...`);
    await client.query(sql);
    console.log("Success.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
