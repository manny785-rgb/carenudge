// Checks that no user, share (with its documents) or access-log entry points at a clinic that is
// not in the database, and moves any that do to Tampines. Safe to run any time.
// Uses Turso when TURSO_DATABASE_URL is set, otherwise the local file data/carenudge.db.
// Usage: npx tsx scripts/check-clinics.ts
import { findOrphans, readDb, repairOrphans, writeDb } from "../src/lib/db";

async function main() {
  const db = await readDb();
  const o = findOrphans(db);
  console.log(`Clinics: ${db.clinics.map((c) => c.name).join(", ")}`);
  console.log(`Orphans: ${o.users.length} users, ${o.shares.length} shares, ${o.audit.length} access-log entries`);
  const moved = repairOrphans(db, "c-tampines");
  if (moved) {
    await writeDb(db);
    console.log(`Repaired: moved ${moved} record(s) to Tampines Community Clinic.`);
  } else console.log("Nothing to repair.");
}

main().catch((e) => {
  console.error("Check failed:", e);
  process.exit(1);
});
