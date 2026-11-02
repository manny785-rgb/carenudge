// Storage layer: Turso (hosted SQLite) in production, or a local SQLite file when no Turso
// variables are set, so `npm run dev` works with no account. Server-side only.
//
//   TURSO_DATABASE_URL  e.g. libsql://your-db-name.turso.io   (default: file:data/carenudge.db)
//   TURSO_AUTH_TOKEN    the database token (not needed for a local file)
//
// The rest of the app still works with one in-memory `Db` object (see src/lib/db.ts). This layer
// loads it from real tables and, on save, writes ONLY the rows that changed (row-level upserts in
// one transaction), so two requests editing different rows don't overwrite each other.
import { createClient, type Client, type InStatement } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { Db, User } from "./db";
import type { CareCase } from "./types";

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

function getClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL || "file:data/carenudge.db";
    if (url.startsWith("file:")) fs.mkdirSync(path.dirname(url.slice("file:".length)), { recursive: true });
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
  }
  return client;
}

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL, clinic_id TEXT, data TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS clinics (id TEXT PRIMARY KEY, data TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS shares (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, clinic_id TEXT NOT NULL, revoked_at TEXT, expires_at TEXT NOT NULL, data TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS shares_clinic ON shares(clinic_id)",
  "CREATE INDEX IF NOT EXISTS shares_patient ON shares(patient_id)",
  "CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, share_id TEXT NOT NULL, clinic_id TEXT NOT NULL, at TEXT NOT NULL, data TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS teach_back (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, data TEXT NOT NULL)",
  // A patient's own saved checks (history, bookings, reports). Clinics never read this table: they see a share's sanitised copy.
  "CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, data TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS cases_patient ON cases(patient_id)",
];

function ensureSchema(): Promise<void> {
  schemaReady ??= getClient()
    .batch(SCHEMA, "write")
    .then(() => undefined)
    .catch((e) => {
      schemaReady = null; // try again on the next request
      throw e;
    });
  return schemaReady;
}

// One entry per table: which Db array it holds and which fields get their own (indexed) column.
// Everything else lives in the JSON `data` column.
type Row = { id?: string };
const TABLES = [
  { table: "users", get: (db: Db): Row[] => db.users, cols: (r: Row) => { const u = r as User; return { email: u.email, role: u.role, clinic_id: u.clinicId }; } },
  { table: "clinics", get: (db: Db): Row[] => db.clinics, cols: () => ({}) },
  { table: "shares", get: (db: Db): Row[] => db.shares, cols: (r: Row) => { const s = r as Db["shares"][number]; return { patient_id: s.patientId, clinic_id: s.clinicId, revoked_at: s.revokedAt, expires_at: s.expiresAt }; } },
  { table: "audit", get: (db: Db): Row[] => db.audit, cols: (r: Row) => { const a = r as Db["audit"][number]; return { share_id: a.shareId, clinic_id: a.clinicId, at: a.at }; } },
  { table: "teach_back", get: (db: Db): Row[] => db.teachBack, cols: (r: Row) => ({ patient_id: (r as Db["teachBack"][number]).patientId }) },
] as const;

// The JSON of each row as it was last loaded or saved, so saves can skip unchanged rows.
interface Snapshot { secret: string; rows: Record<string, Map<string, string>> }
const snapshots = new WeakMap<Db, Snapshot>();

const upsert = (table: string, id: string, cols: Record<string, unknown>, json: string): InStatement => {
  const names = ["id", ...Object.keys(cols), "data"];
  const updates = names.slice(1).map((n) => `${n} = excluded.${n}`).join(", ");
  return {
    sql: `INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")}) ON CONFLICT(id) DO UPDATE SET ${updates}`,
    args: [id, ...(Object.values(cols) as (string | null)[]), json],
  };
};

const secretUpsert = (secret: string): InStatement => ({
  sql: "INSERT INTO meta (key, value) VALUES ('secret', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  args: [secret],
});

/** Load everything in one round trip. Returns null when the database has never been seeded. */
export async function loadDb(): Promise<Db | null> {
  await ensureSchema();
  const rs = await getClient().batch(
    [
      "SELECT value FROM meta WHERE key = 'secret'",
      ...TABLES.map((t) => `SELECT data FROM ${t.table} ORDER BY rowid`),
    ],
    "read",
  );
  const secret = rs[0].rows[0]?.value as string | undefined;
  if (!secret) return null;

  const parse = (i: number) => rs[i + 1].rows.map((r) => JSON.parse(r.data as string));
  const db = { secret, users: parse(0), clinics: parse(1), shares: parse(2), audit: parse(3), teachBack: parse(4) } as Db;
  remember(db);
  return db;
}

function remember(db: Db) {
  const rows: Snapshot["rows"] = {};
  for (const t of TABLES) rows[t.table] = new Map(t.get(db).filter((r) => r.id).map((r) => [r.id!, JSON.stringify(r)]));
  snapshots.set(db, { secret: db.secret, rows });
}

/** Write only the rows that changed since this Db was loaded (new rows get an id). */
export async function saveDb(db: Db): Promise<void> {
  await ensureSchema();
  const snap = snapshots.get(db);
  const statements: InStatement[] = [];
  if (!snap || snap.secret !== db.secret) statements.push(secretUpsert(db.secret));

  for (const t of TABLES) {
    const before = snap?.rows[t.table] ?? new Map<string, string>();
    const seen = new Set<string>();
    for (const row of t.get(db)) {
      row.id ??= randomBytes(6).toString("hex"); // e.g. teach-back events have no natural id
      seen.add(row.id);
      const json = JSON.stringify(row);
      if (before.get(row.id) !== json) statements.push(upsert(t.table, row.id, t.cols(row), json));
    }
    for (const id of before.keys()) if (!seen.has(id)) statements.push({ sql: `DELETE FROM ${t.table} WHERE id = ?`, args: [id] });
  }

  if (statements.length) await getClient().batch(statements, "write");
  remember(db);
}

/** A patient's check and who owns it. */
export interface OwnedCase { patientId: string; case: CareCase }

/** Replace everything with `db` and the patients' checks (used by seeding and `npm run reset-demo`). */
export async function resetDb(db: Db, cases: OwnedCase[] = []): Promise<void> {
  await ensureSchema();
  const statements: InStatement[] = [
    ...["meta", "cases", ...TABLES.map((t) => t.table)].map((t): InStatement => `DELETE FROM ${t}`),
    secretUpsert(db.secret),
  ];
  for (const t of TABLES) {
    for (const row of t.get(db)) {
      row.id ??= randomBytes(6).toString("hex");
      statements.push(upsert(t.table, row.id, t.cols(row), JSON.stringify(row)));
    }
  }
  for (const o of cases) statements.push(caseUpsert(o));
  await getClient().batch(statements, "write");
  remember(db);
}

// --- A patient's own checks. Row-level, separate from the shared Db object. ---

const caseUpsert = (o: OwnedCase): InStatement => ({
  sql: "INSERT INTO cases (id, patient_id, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
  args: [o.case.id, o.patientId, JSON.stringify(o.case)],
});

export async function listCases(patientId: string): Promise<CareCase[]> {
  await ensureSchema();
  const rs = await getClient().execute({ sql: "SELECT data FROM cases WHERE patient_id = ? ORDER BY rowid DESC", args: [patientId] });
  return rs.rows.map((r) => JSON.parse(r.data as string) as CareCase);
}

/** One check with its owner, or null. Callers must compare the owner with the signed-in patient. */
export async function getCaseRow(id: string): Promise<OwnedCase | null> {
  await ensureSchema();
  const rs = await getClient().execute({ sql: "SELECT patient_id, data FROM cases WHERE id = ?", args: [id] });
  const r = rs.rows[0];
  return r ? { patientId: r.patient_id as string, case: JSON.parse(r.data as string) as CareCase } : null;
}

export async function saveCaseRow(o: OwnedCase): Promise<void> {
  await ensureSchema();
  await getClient().execute(caseUpsert(o));
}

/** Delete one check (or, with no id, all of this patient's checks). */
export async function deleteCaseRows(patientId: string, id?: string): Promise<void> {
  await ensureSchema();
  await getClient().execute(id ? { sql: "DELETE FROM cases WHERE patient_id = ? AND id = ?", args: [patientId, id] } : { sql: "DELETE FROM cases WHERE patient_id = ?", args: [patientId] });
}

/** Just what is needed to check a session cookie, without loading every table. */
export async function getAuthData(userId: string): Promise<{ secret: string | null; user: User | null }> {
  await ensureSchema();
  const [s, u] = await getClient().batch(
    [
      { sql: "SELECT value FROM meta WHERE key = 'secret'", args: [] },
      { sql: "SELECT data FROM users WHERE id = ?", args: [userId] },
    ],
    "read",
  );
  return { secret: (s.rows[0]?.value as string | undefined) ?? null, user: u.rows[0] ? (JSON.parse(u.rows[0].data as string) as User) : null };
}
