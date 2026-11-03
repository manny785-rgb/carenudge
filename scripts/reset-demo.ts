// Resets the demo database (users, shares, audit log) to the seed data.
// Uses Turso when TURSO_DATABASE_URL is set, otherwise the local file data/carenudge.db.
// A local reset first copies the file to backups/ (git-ignored), so test data can be put back.
// Usage: npm run reset-demo
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { seed } from "../src/lib/db";

function backupLocal() {
  const file = "data/carenudge.db";
  if (process.env.TURSO_DATABASE_URL || !existsSync(file)) return;
  mkdirSync("backups", { recursive: true });
  const dest = `backups/carenudge-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
  copyFileSync(file, dest);
  console.log(`Backed up the local database to ${dest} (copy it back over ${file} to undo).`);
}

async function main() {
  backupLocal();
  const db = await seed();
  console.log(`Demo data reset: ${db.users.length} users, ${db.shares.length} shares.`);
}

main().catch((e) => {
  console.error("Reset failed:", e);
  process.exit(1);
});
