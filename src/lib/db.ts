// Data model, demo seed data and the access rules. Persistence (Turso or a local SQLite file)
// lives in dbstore.ts. Fake data only. Server-side only: never import it from a client component.
import { randomBytes } from "node:crypto";
import { ACTIVE_CLINICS, CLINICS, SHARE_WINDOW_DAYS, type Clinic } from "./clinics";
import { loadDb, resetDb, saveDb, type OwnedCase } from "./dbstore";
import { offlineParse } from "./offlineParser";
import { PERSONAS } from "./personas";
import { evaluate } from "./rules/engine";
import { addDays, sgToday } from "./sgtime";
import type { Role } from "./roles";
import type { CareCase, FollowUp, HealthSummary, Report, TestResult } from "./types";

export type { Role };

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  clinicId: string | null;
}

export type ShareStatus = "new" | "reviewed" | "follow_up_set";
export type AppointmentStatus = "scheduled" | "cancelled" | "no_show" | "completed";

/** The last time the appointment was cancelled or moved, and who did it. Facts only, no reasons. */
export interface ShareChange {
  kind: "cancelled" | "rescheduled";
  by: "patient" | "clinic";
  at: string;
  fromDate: string;
  fromTime: string | null;
  /** Whether doctors / operations have acknowledged it ("Got it"). The side that made the change has already seen it. */
  seen: { doctor: boolean; ops: boolean };
}

/** A patient's consented summary for exactly one clinic. */
export interface Share {
  id: string;
  patientId: string;
  patientName: string;
  clinicId: string;
  appointmentDate: string; // yyyy-mm-dd
  appointmentTime: string | null; // HH:MM, Singapore time
  /** Managed by clinic operations. A cancelled appointment hides the patient from the doctor. */
  appointmentStatus: AppointmentStatus;
  sharedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  status: ShareStatus;
  /** Seconds from a doctor first opening the request to first saving. Feeds the dashboard. */
  firstOpenedAt: string | null;
  prepSeconds: number | null;
  /** The patient's booking (a follow-up id in their check) that this share's appointment follows. */
  bookingId?: string;
  /** When the patient's side of this share last changed (history, bookings, reports, appointment). Clinic-side edits do not count. */
  updatedAt?: string;
  /** When each clinic user last looked at this share, by user id. Drives the "New request" / "New changes" tags. */
  viewedBy?: Record<string, string>;
  /** Most recent cancel or reschedule. Shown on the clinic schedules. */
  change?: ShareChange;
  snapshot: CareCase;
}

/** Every time a doctor opens a patient's summary or brief. */
export interface AuditEntry {
  id: string;
  shareId: string;
  patientId: string;
  clinicId: string;
  doctorId: string;
  doctorName: string;
  action: "opened_summary" | "opened_brief" | "sent_reminder";
  at: string;
}

/** Teach-back answers, recorded when a patient answers the "did the nudge make sense" check. */
export interface TeachBackEvent {
  id?: string;
  patientId: string;
  ruleId: string;
  whyCorrect: boolean;
  actionCorrect: boolean;
  at: string;
}

export interface Db {
  secret: string; // signs session cookies
  users: User[];
  clinics: Clinic[]; // editable copy of the seeded demo clinics
  shares: Share[];
  audit: AuditEntry[];
  teachBack: TeachBackEvent[];
}

const newId = () => randomBytes(6).toString("hex");
export { newId };

/** Summary built from a demo persona, as if the patient had confirmed it. */
function personaSummary(key: string): HealthSummary {
  const persona = PERSONAS.find((p) => p.key === key)!;
  const parsed = offlineParse(persona.rawHistory);
  return {
    ...persona.base,
    relatives: parsed.relatives,
    medications: parsed.medications.filter((m) => m.forWhom === "me"),
    gestationalDiabetes: null,
    onDiabetesTreatment: false,
    uncertain: [],
  };
}

const shareBase = (patient: User, clinicId: string, id: string, caseId: string, summary: HealthSummary) => {
  const nowIso = new Date().toISOString();
  const snapshot: CareCase = {
    id: caseId,
    displayName: patient.name,
    createdAt: nowIso,
    consentAt: nowIso,
    rawHistory: "",
    parsedBy: "offline",
    confirmedAt: nowIso,
    summary,
    rules: evaluate(summary),
    language: "English",
    sharedAt: null,
    findings: { bpSys: "", bpDia: "", bmi: "", hba1c: "", fastingGlucose: "", notes: "", reviewedAt: null },
    followUps: [],
    reports: [],
    results: [],
  };
  const share: Share = {
    id,
    patientId: patient.id,
    patientName: patient.name,
    clinicId,
    appointmentDate: "",
    appointmentTime: null,
    appointmentStatus: "scheduled",
    sharedAt: nowIso,
    expiresAt: new Date(Date.now() + SHARE_WINDOW_DAYS * 86_400_000).toISOString(),
    revokedAt: null,
    status: "new",
    firstOpenedAt: null,
    prepSeconds: null,
    snapshot,
  };
  return share;
};

/** Mei Ling at Tampines: upcoming visit, an overdue follow-up, a done one, doctor-confirmed results. */
function seedMeiLing(patient: User): Share {
  const today = sgToday();
  const clinic = CLINICS.find((c) => c.id === "c-tampines")!;
  const s = shareBase(patient, clinic.id, "s-seed-1", "seed-meiling", personaSummary("meiling"));
  const fu = (f: Omit<FollowUp, "where" | "result"> & Partial<FollowUp>): FollowUp => ({ where: clinic.name, result: "", ...f });
  const res = (id: string, test: string, value: number, unit: string, date: string, source: TestResult["source"], range: [number, number] | null): TestResult => ({
    id, test, value, unit, date, rangeLow: range?.[0] ?? null, rangeHigh: range?.[1] ?? null, source,
  });
  s.bookingId = "seed-f1";
  s.appointmentDate = addDays(today, 3);
  s.appointmentTime = "10:30";
  s.sharedAt = addDays(today, -20) + "T02:00:00.000Z";
  s.status = "follow_up_set";
  s.prepSeconds = 95;
  s.snapshot.findings.reviewedAt = new Date().toISOString();
  s.snapshot.followUps = [
    fu({ id: "seed-f1", test: "Diabetes screening (blood test)", dueDate: s.appointmentDate, time: "10:30", status: "booked", createdBy: "patient" }),
    fu({ id: "seed-f2", test: "HbA1c", dueDate: addDays(today, -10), status: "planned", createdBy: "doctor", reminders: [] }),
    fu({ id: "seed-f3", test: "Fasting plasma glucose", dueDate: addDays(today, -20), status: "done", createdBy: "doctor", doneDate: addDays(today, -18), result: "5.4 mmol/L" }),
    fu({ id: "seed-f4", test: "Review visit", dueDate: addDays(today, 12), status: "planned", createdBy: "doctor" }),
  ];
  s.snapshot.results = [
    res("seed-r1", "HbA1c", 5.5, "%", addDays(today, -200), "doctor-confirmed", [4, 5.6]),
    res("seed-r2", "HbA1c", 5.8, "%", addDays(today, -18), "doctor-confirmed", [4, 5.6]),
    res("seed-r3", "Fasting glucose", 5.2, "mmol/L", addDays(today, -400), "patient-reported", null),
  ];
  return s;
}

/** Daniel at Tampines: a recent visit he did not attend (shows a no-show in the schedule). */
function seedDaniel(patient: User): Share {
  const today = sgToday();
  const clinic = CLINICS.find((c) => c.id === "c-tampines")!;
  const s = shareBase(patient, clinic.id, "s-seed-2", "seed-daniel", personaSummary("daniel"));
  s.bookingId = "seed-d1";
  s.appointmentDate = addDays(today, -2);
  s.appointmentTime = "15:00";
  s.appointmentStatus = "no_show";
  s.snapshot.followUps = [
    { id: "seed-d1", test: "Diabetes screening (blood test)", dueDate: s.appointmentDate, time: "15:00", status: "missed", where: clinic.name, result: "", createdBy: "patient" },
  ];
  return s;
}

/** Arjun at the second demo clinic: an upcoming visit and one follow-up still planned, so its dashboard has data too. */
function seedArjun(patient: User): Share {
  const today = sgToday();
  const clinic = CLINICS.find((c) => c.id === "c-demo-bedok")!;
  const s = shareBase(patient, clinic.id, "s-seed-3", "seed-arjun", personaSummary("arjun"));
  s.bookingId = "seed-a1";
  s.appointmentDate = addDays(today, 5);
  s.appointmentTime = "11:00";
  s.sharedAt = addDays(today, -3) + "T02:00:00.000Z";
  s.snapshot.followUps = [
    { id: "seed-a1", test: "Diabetes screening (blood test)", dueDate: s.appointmentDate, time: "11:00", status: "booked", where: clinic.name, result: "", createdBy: "patient" },
    { id: "seed-a2", test: "Blood pressure check", dueDate: addDays(today, 6), status: "planned", where: clinic.name, result: "", createdBy: "doctor" },
  ];
  return s;
}

/** One background patient: a fictional person with a shared booking, so the dashboards have numbers to count. */
interface BgSpec {
  name: string;
  persona: string; // whose health summary (and so nudges) this patient shares
  appt: number; // appointment day, relative to today
  time: string;
  status?: AppointmentStatus;
  prep?: number; // seconds the doctor took to prepare
  followUps?: [test: string, dueOffset: number, status: FollowUp["status"], by: FollowUp["createdBy"]][];
  teachBack?: [why: boolean, action: boolean];
}

const BACKGROUND: Record<string, BgSpec[]> = {
  "c-tampines": [
    { name: "Priya N.", persona: "siti", appt: -5, time: "09:30", status: "completed", prep: 140, followUps: [["HbA1c", -4, "done", "doctor"], ["Review visit", 10, "planned", "doctor"]], teachBack: [true, true] },
    { name: "Hassan R.", persona: "arjun", appt: 1, time: "14:00", prep: 80, followUps: [["Fasting plasma glucose", 2, "planned", "doctor"]], teachBack: [true, false] },
    { name: "Grace T.", persona: "meiling", appt: -12, time: "11:00", status: "completed", prep: 210, followUps: [["HbA1c", -3, "planned", "doctor"]], teachBack: [true, true] },
    { name: "Kumar S.", persona: "daniel", appt: -6, time: "16:00", status: "no_show" },
    { name: "Wei Jie L.", persona: "arjun", appt: 9, time: "10:00", followUps: [["Blood pressure check", 20, "planned", "doctor"]], teachBack: [false, false] },
    { name: "Nora B.", persona: "siti", appt: -1, time: "13:30", status: "cancelled" },
  ],
  "c-demo-bedok": [
    { name: "Farah A.", persona: "meiling", appt: -4, time: "10:30", status: "completed", prep: 120, followUps: [["HbA1c", -3, "done", "doctor"]], teachBack: [true, true] },
    { name: "Lim H.", persona: "arjun", appt: 2, time: "15:00", prep: 60, followUps: [["Blood pressure check", 3, "planned", "doctor"]], teachBack: [true, false] },
    { name: "Ravi M.", persona: "daniel", appt: -3, time: "09:00", status: "no_show" },
    { name: "Jia Hui C.", persona: "siti", appt: 14, time: "11:30", followUps: [["Review visit", 21, "planned", "doctor"]] },
  ],
};

/** Background patients, their shares and teach-back answers for every active clinic. Fake data, generated from BACKGROUND. */
function seedBackground(): { users: User[]; shares: Share[]; teachBack: TeachBackEvent[] } {
  const today = sgToday();
  const out = { users: [] as User[], shares: [] as Share[], teachBack: [] as TeachBackEvent[] };
  for (const [clinicId, specs] of Object.entries(BACKGROUND)) {
    const clinic = CLINICS.find((c) => c.id === clinicId);
    if (!clinic || clinic.active === false) continue; // a switched-off clinic gets no background data
    specs.forEach((b, i) => {
      const n = out.users.length + 1;
      const patient: User = { id: `u-bg-${n}`, name: b.name, email: `bg${n}@demo.test`, role: "patient", clinicId };
      const sh = shareBase(patient, clinicId, `s-bg-${n}`, `bg-case-${n}`, personaSummary(b.persona));
      sh.appointmentDate = addDays(today, b.appt);
      sh.appointmentTime = b.time;
      sh.appointmentStatus = b.status ?? "scheduled";
      sh.sharedAt = addDays(today, Math.min(b.appt, 0) - 3) + "T02:00:00.000Z";
      sh.prepSeconds = b.prep ?? null;
      if (b.prep) { sh.firstOpenedAt = sh.sharedAt; sh.status = b.followUps?.length ? "follow_up_set" : "reviewed"; }
      sh.snapshot.followUps = (b.followUps ?? []).map(([test, off, status, by], j) => ({
        id: `bg${n}-f${j}`, test, dueDate: addDays(today, off), status, where: clinic.name, result: "", createdBy: by,
        ...(status === "done" ? { doneDate: addDays(today, off) } : {}),
      }));
      if (b.teachBack) out.teachBack.push({ patientId: patient.id, ruleId: sh.snapshot.rules?.nudges[0]?.ruleId ?? "DM-AGE40", whyCorrect: b.teachBack[0], actionCorrect: b.teachBack[1], at: addDays(today, -2 - i) + "T03:00:00.000Z" });
      out.users.push(patient);
      out.shares.push(sh);
    });
  }
  return out;
}

/** The patient's own check behind a seeded share: only the parts a patient owns (no findings or confirmed results). */
function caseFromShare(s: Share): OwnedCase {
  const c = s.snapshot;
  return {
    patientId: s.patientId,
    case: {
      ...c,
      sharedAt: s.sharedAt,
      findings: { bpSys: "", bpDia: "", bmi: "", hba1c: "", fastingGlucose: "", notes: "", reviewedAt: null },
      followUps: c.followUps.filter((f) => f.createdBy === "patient"),
      results: (c.results ?? []).filter((r) => r.source === "patient-reported"),
      reports: [],
    },
  };
}

/**
 * Fresh demo data for the two active clinics (see ACTIVE_CLINICS): the personas as patients, a doctor
 * and an ops user at each clinic, and demo shares at both (Mei Ling and Daniel at Tampines, Arjun at
 * the Bedok demo clinic) plus the BACKGROUND patients (ids u-bg-N, hidden from the sign-in list) who give
 * the dashboards numbers to count. Dashboards are computed from these records, not hard-coded.
 */
export async function seed(): Promise<Db> {
  const patients: User[] = PERSONAS.map((p) => ({
    id: `u-${p.key}`,
    name: p.displayName.split(",")[0],
    email: `${p.key}@demo.test`,
    role: "patient",
    clinicId: p.key === "meiling" || p.key === "daniel" ? "c-tampines" : p.key === "arjun" ? "c-demo-bedok" : null,
  }));
  const staff: User[] = [
    { id: "u-doc-2", name: "Dr. Rahman", email: "doctor2@demo.test", role: "doctor", clinicId: "c-tampines" },
    { id: "u-ops-2", name: "Aisha (Ops)", email: "ops.tampines@demo.test", role: "clinic_ops", clinicId: "c-tampines" },
    { id: "u-doc-1", name: "Dr. Tan", email: "doctor1@demo.test", role: "doctor", clinicId: "c-demo-bedok" },
    { id: "u-ops-1", name: "Ben (Ops)", email: "ops.bedok@demo.test", role: "clinic_ops", clinicId: "c-demo-bedok" },
  ];
  const meiLing = patients.find((p) => p.id === "u-meiling")!;
  const daniel = patients.find((p) => p.id === "u-daniel")!;
  const share = seedMeiLing(meiLing);
  const tbRule = share.snapshot.rules?.nudges[0]?.ruleId ?? "DM-AGE40";
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  const bg = seedBackground();
  // Keep the existing session-signing secret: a reset replaces the data, but signed-in browsers stay signed in
  // (the seeded users keep their ids). A new secret would silently turn every open page's requests into 401s.
  const existing = await loadDb().catch(() => null);
  const db: Db = {
    secret: existing?.secret ?? randomBytes(32).toString("hex"),
    users: [...patients, ...staff, ...bg.users],
    // The demo clinics start on Pro so every feature works; downgrade on the Subscription page to see the paywall.
    clinics: ACTIVE_CLINICS.map((c) => ({ ...c, demo: true, plan: "pro" as const, planSince: new Date().toISOString() })),
    shares: [share, seedDaniel(daniel), seedArjun(patients.find((p) => p.id === "u-arjun")!), ...bg.shares],
    teachBack: [
      { patientId: meiLing.id, ruleId: tbRule, whyCorrect: true, actionCorrect: true, at: daysAgo(20) },
      { patientId: meiLing.id, ruleId: tbRule, whyCorrect: true, actionCorrect: false, at: daysAgo(19) },
      ...bg.teachBack,
    ],
    audit: [
      { id: newId(), shareId: share.id, patientId: meiLing.id, clinicId: share.clinicId, doctorId: "u-doc-2", doctorName: "Dr. Rahman", action: "opened_summary", at: daysAgo(18) },
    ],
  };
  const staffOf: Record<string, string[]> = { "c-tampines": ["u-doc-2", "u-ops-2"], "c-demo-bedok": ["u-doc-1", "u-ops-1"] };
  for (const sh of db.shares) {
    sh.updatedAt = sh.sharedAt;
    if (sh.id !== "s-seed-3") sh.viewedBy = Object.fromEntries((staffOf[sh.clinicId] ?? []).map((id) => [id, new Date().toISOString()]));
  }
  // Siti has no clinic yet (so no share), but she still starts with a saved, confirmed check like the others.
  const siti = patients.find((p) => p.id === "u-siti")!;
  const sitiSummary = { ...personaSummary("siti"), gestationalDiabetes: true as const };
  const sitiCase = { ...shareBase(siti, "", "seed-siti-share", "seed-siti", sitiSummary).snapshot, rules: evaluate(sitiSummary) };
  await resetDb(db, [...db.shares.map(caseFromShare), { patientId: siti.id, case: sitiCase }]);
  return db;
}

/**
 * Records that point at a clinic that no longer exists (for example after clinics were switched off).
 * Shared documents live inside their share, so they are covered by the share's clinic.
 */
export function findOrphans(db: Db): { users: User[]; shares: Share[]; audit: AuditEntry[] } {
  const known = new Set(db.clinics.map((c) => c.id));
  return {
    users: db.users.filter((u) => u.clinicId !== null && !known.has(u.clinicId)),
    shares: db.shares.filter((s) => !known.has(s.clinicId)),
    audit: db.audit.filter((a) => !known.has(a.clinicId)),
  };
}

/** Point every orphaned record at the fallback clinic. Returns how many records moved. */
export function repairOrphans(db: Db, fallbackClinicId: string): number {
  const o = findOrphans(db);
  for (const r of [...o.users, ...o.shares, ...o.audit]) if ("clinicId" in r) r.clinicId = fallbackClinicId;
  return o.users.length + o.shares.length + o.audit.length;
}

let seeding: Promise<Db> | null = null;

/** Load everything. A brand-new database is seeded with the demo data first (once, even if requests race). */
export async function readDb(): Promise<Db> {
  const db = await loadDb();
  if (db) return db;
  seeding ??= seed().finally(() => (seeding = null));
  return seeding;
}

/** Save the rows this request changed. */
export async function writeDb(db: Db): Promise<void> {
  await saveDb(db);
}

/** Active = not revoked and not past its expiry. Everything else is invisible to doctors. */
export const isActive = (s: Share, now = Date.now()) => !s.revokedAt && new Date(s.expiresAt).getTime() > now;

/** Consent still valid: not revoked, not expired. Doctors and ops both start from this. */
const consented = (s: Share) => isActive(s);

/**
 * THE doctor access rule. A doctor gets a share only if it belongs to their own clinic (from
 * their server-side profile), was shared with consent, is not revoked or expired, and the
 * appointment has not been cancelled. Anything else returns null, which routes answer as 404.
 */
export function shareForDoctor(db: Db, doctor: User, id: string | null): Share | null {
  if (doctor.role !== "doctor" || !doctor.clinicId) return null;
  return db.shares.find((s) => s.id === id && s.clinicId === doctor.clinicId && consented(s) && s.appointmentStatus !== "cancelled") ?? null;
}

/** Active shares a doctor may see (their clinic only, appointment not cancelled). */
export const sharesForDoctor = (db: Db, doctor: User) =>
  doctor.role === "doctor" && doctor.clinicId ? db.shares.filter((s) => s.clinicId === doctor.clinicId && consented(s) && s.appointmentStatus !== "cancelled") : [];

/**
 * Clinic operations get the same clinic scoping and consent rule, but callers must only ever
 * return logistics from these shares (name, date, time, status), never the clinical snapshot.
 */
export function shareForOps(db: Db, ops: User, id: string | null): Share | null {
  if (ops.role !== "clinic_ops" || !ops.clinicId) return null;
  return db.shares.find((s) => s.id === id && s.clinicId === ops.clinicId && consented(s)) ?? null;
}

export const sharesForOps = (db: Db, ops: User) =>
  ops.role === "clinic_ops" && ops.clinicId ? db.shares.filter((s) => s.clinicId === ops.clinicId && consented(s)) : [];

/** Doctor's schedule rows: every consented share at their clinic, cancelled ones included. Callers return logistics only. */
export const scheduleForDoctor = (db: Db, doctor: User) =>
  doctor.role === "doctor" && doctor.clinicId ? db.shares.filter((s) => s.clinicId === doctor.clinicId && consented(s)) : [];

/** Note a cancel or reschedule on the share. Call BEFORE changing the date, so the old one is kept. */
export function recordChange(share: Share, kind: ShareChange["kind"], by: ShareChange["by"]) {
  share.change = { kind, by, at: new Date().toISOString(), fromDate: share.appointmentDate, fromTime: share.appointmentTime, seen: { doctor: by === "clinic", ops: by === "clinic" } };
}

/** "new" if this user has never looked at the share, "changed" if it changed since they last looked, else null. */
export function flagFor(share: Share, userId: string): "new" | "changed" | null {
  const seen = share.viewedBy?.[userId];
  if (!seen) return "new";
  return (share.updatedAt ?? share.sharedAt) > seen ? "changed" : null;
}

/** Remember that this user has now seen the share as it is. */
export const markViewed = (share: Share, userId: string) => {
  share.viewedBy = { ...share.viewedBy, [userId]: new Date().toISOString() };
};

/** The patient-side content of a share has changed: clinic users should see a "New changes" tag. */
export const touch = (share: Share) => {
  share.updatedAt = new Date().toISOString();
};

/** JSON with sorted keys, so two equal objects always compare equal whatever order they were built in. */
const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

export function logAccess(db: Db, doctor: User, share: Share, action: AuditEntry["action"]) {
  db.audit.push({ id: newId(), shareId: share.id, patientId: share.patientId, clinicId: share.clinicId, doctorId: doctor.id, doctorName: doctor.name, action, at: new Date().toISOString() });
}

export function expiryFor(appointmentDate: string): string {
  const base = Math.max(new Date(appointmentDate).getTime(), Date.now());
  return new Date(base + SHARE_WINDOW_DAYS * 86_400_000).toISOString();
}

/**
 * Keep only what a clinic needs: the confirmed summary and the nudges. Raw history text,
 * medicines for people the patient cares for are never sent. Uploaded reports are sent only when the
 * patient ticked them: the client includes just those, and sanitizeReports keeps them safe to store.
 */
export const REPORT_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_REPORT_BASE64 = 4_000_000; // per file, about 3 MB of original
const MAX_REPORTS = 10;

/** Keep only the fields a clinic needs, an allowed file type, and a sane size. Everything else is dropped. */
export function sanitizeReports(list: Report[] | undefined): Report[] {
  return (list ?? [])
    .filter((r) => r && typeof r.content === "string" && /^[A-Za-z0-9+/=]+$/.test(r.content) && r.content.length <= MAX_REPORT_BASE64 && REPORT_MIME.includes(r.mimeType ?? ""))
    .slice(0, MAX_REPORTS)
    .map((r) => ({
      id: String(r.id).slice(0, 64),
      filename: String(r.filename).replace(/[^\w .()-]/g, "_").slice(0, 100),
      content: r.content,
      mimeType: r.mimeType,
      kind: r.kind === "other" ? ("other" as const) : ("lab" as const),
      uploadedAt: String(r.uploadedAt).slice(0, 30),
      clinic: r.clinic ? String(r.clinic).slice(0, 100) : undefined,
      shared: true,
    }));
}

/**
 * The clinic's copy of a patient's check. The patient-owned parts (summary, nudges, their own bookings,
 * patient-reported values, reports they submitted) come from the check; the parts the clinic added
 * (findings, confirmed results, follow-ups) are kept from the previous copy.
 */
export function deriveSnapshot(c: CareCase, previous?: CareCase): CareCase {
  const clean = sanitizeSnapshot(c);
  if (!previous) return clean;
  const before = new Map(previous.followUps.map((f) => [f.id, f]));
  // A follow-up the patient made (their booking) can still be reminded or marked done by the clinic. Keep those marks.
  const patientOnes = clean.followUps
    .filter((f) => f.createdBy === "patient")
    .map((f) => {
      const old = before.get(f.id);
      if (!old) return f;
      return { ...f, ...(old.reminders?.length ? { reminders: old.reminders } : {}), ...(old.status === "done" ? { status: old.status, doneDate: old.doneDate, result: old.result } : {}) };
    });
  return {
    ...clean,
    findings: previous.findings,
    results: [...(previous.results ?? []).filter((r) => r.source === "doctor-confirmed"), ...(clean.results ?? [])],
    followUps: [...patientOnes, ...previous.followUps.filter((f) => f.createdBy === "doctor")],
  };
}

/**
 * The patient saved a check. Bring every live share of it up to date, so what the clinic sees can never
 * drift from the patient's own record: summary, bookings, submitted reports and the appointment itself
 * (a moved booking reschedules the share; a removed future booking cancels it).
 */
export function syncSharesFromCase(db: Db, patientId: string, c: CareCase, today = sgToday()): void {
  if (!c.confirmedAt || !c.rules || !c.summary) return; // a half-finished check is never sent
  for (const share of db.shares) {
    if (share.patientId !== patientId || share.snapshot.id !== c.id || share.revokedAt) continue;
    const before = stable([share.snapshot, share.appointmentDate, share.appointmentTime, share.appointmentStatus]);
    share.snapshot = deriveSnapshot(c, share.snapshot);
    const booking = share.bookingId && share.appointmentStatus !== "cancelled" ? c.followUps.find((f) => f.id === share.bookingId) : undefined;
    if (share.bookingId && share.appointmentStatus !== "cancelled") {
      if (!booking) {
        // Dropping a booking whose date has passed is tidying up, not cancelling.
        if (share.appointmentDate >= today) {
          recordChange(share, "cancelled", "patient");
          share.appointmentStatus = "cancelled";
        }
      } else if (booking.dueDate !== share.appointmentDate || (booking.time ?? null) !== share.appointmentTime) {
        recordChange(share, "rescheduled", "patient");
        share.appointmentDate = booking.dueDate;
        share.appointmentTime = booking.time ?? null;
        share.appointmentStatus = "scheduled";
        share.expiresAt = expiryFor(booking.dueDate);
      }
    }
    // Only a real change raises the "New changes" tag; saving the same content again does not.
    if (stable([share.snapshot, share.appointmentDate, share.appointmentTime, share.appointmentStatus]) !== before) touch(share);
  }
}

export function sanitizeSnapshot(c: CareCase): CareCase {
  return {
    ...c,
    rawHistory: "",
    reports: sanitizeReports((c.reports ?? []).filter((r) => r.shared === true)),
    sharedAt: null,
    // A patient can never mark values as doctor-confirmed; only the doctor's route does that.
    results: (c.results ?? []).map((r) => ({ ...r, source: "patient-reported" as const })),
    summary: { ...c.summary, medications: c.summary.medications.filter((m) => m.forWhom === "me"), uncertain: [] },
  };
}
