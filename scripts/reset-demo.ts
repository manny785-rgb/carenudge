// Resets the demo database (users, shares, audit log) to the seed data.
// Uses Turso when TURSO_DATABASE_URL is set, otherwise the local file data/carenudge.db.
// Usage: npm run reset-demo
import { seed } from "../src/lib/db";

async function main() {
  const db = await seed();
  console.log(`Demo data reset: ${db.users.length} users, ${db.shares.length} shares.`);
}

main().catch((e) => {
  console.error("Reset failed:", e);
  process.exit(1);
});
