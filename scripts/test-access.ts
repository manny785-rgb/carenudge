// Tries forbidden (and allowed) accesses against a RUNNING server and prints PASS/FAIL.
// Usage: start the app (npm run dev, or npm run build && npm start), then:  npm run test:access
// Optional: BASE_URL=http://localhost:3000 (default). It resets the demo data first, so any
// shares or edits you made in the demo are replaced with the seed data.
import { findOrphans, readDb, seed } from "../src/lib/db";
import { addDays, sgToday } from "../src/lib/sgtime";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

type Jar = { cookie: string };
const jar = (): Jar => ({ cookie: "" });

async function call(j: Jar, method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    redirect: "manual",
    headers: { "Content-Type": "application/json", cookie: j.cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get("set-cookie");
  if (set) j.cookie = set.split(";")[0];
  const text = await res.text();
  let json: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text, location: res.headers.get("location") ?? "" };
}

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}
const section = (s: string) => console.log(`\n== ${s}`);

async function signIn(userId: string) {
  const j = jar();
  await call(j, "POST", "/api/auth", { userId });
  return j;
}

async function main() {
  await seed();
  const patient = await signIn("u-meiling"); // Tampines patient
  const docT = await signIn("u-doc-2"); // Dr. Rahman, Tampines
  const opsT = await signIn("u-ops-2"); // ops, Tampines
  const docB = await signIn("u-doc-1"); // Dr. Tan, Demo Clinic - Bedok
  const opsB = await signIn("u-ops-1"); // ops, Demo Clinic - Bedok
  const anon = jar();
  const forged = { cookie: "cn_session=u-doc-2.deadbeef" };
  const SHARE = "s-seed-1";
  const CLINICAL = /HbA1c|DM-AGE40|metformin|father|relatives|Fasting|rules|snapshot|nudge/i;

  section("Signed-out and forged sessions");
  for (const p of ["/api/requests", "/api/dashboard", "/api/appointments", "/api/followups", "/api/audit", "/api/clinic-profile", "/api/shares"]) {
    check(`signed-out ${p} -> 401`, (await call(anon, "GET", p)).status === 401);
  }
  check("forged cookie -> 401", (await call(forged, "GET", "/api/requests")).status === 401);
  for (const p of ["/doctor", "/clinic", "/intake", "/requests", "/clinic/dashboard"]) {
    const r = await call(anon, "GET", p);
    check(`signed-out page ${p} redirects to sign-in`, r.status >= 300 && r.status < 400 && r.location.includes("/signup"), `${r.status} ${r.location}`);
  }

  section("Doctor (Tampines) must NOT reach clinic operations");
  for (const [m, p] of [["GET", "/api/dashboard"], ["GET", "/api/clinic-profile"], ["PATCH", "/api/clinic-profile"], ["GET", "/api/audit"], ["PATCH", "/api/appointments"], ["PATCH", "/api/profile"]]) {
    check(`doctor ${m} ${p} -> 403`, (await call(docT, m, p, m === "GET" ? undefined : {})).status === 403);
  }
  for (const p of ["/clinic", "/clinic/dashboard", "/clinic/profile", "/clinic/audit", "/clinic/followups", "/clinic/listing"]) {
    const r = await call(docT, "GET", p);
    check(`doctor page ${p} redirected away`, r.status >= 300 && r.status < 400 && !r.location.includes(p) && r.location.endsWith("/doctor/home"), `${r.status} ${r.location}`);
  }
  check("doctor cannot mark appointment via ops API", (await call(docT, "PATCH", "/api/appointments", { shareId: SHARE, action: "cancel" })).status === 403);

  section("Doctor (Tampines) CAN use clinical features");
  const req = await call(docT, "GET", "/api/requests");
  check("doctor sees patient requests", req.status === 200 && req.json.requests.length === 7, `${req.json?.requests?.length} requests`);
  const detail = await call(docT, "GET", `/api/requests?id=${SHARE}`);
  check("doctor opens the patient summary", detail.status === 200 && detail.json.request.snapshot.summary.relatives.length > 0);
  const baseSnap = detail.json.request.snapshot;
  check("doctor sees clinical follow-ups", (await call(docT, "GET", "/api/followups")).json.items.some((i: { test: string }) => i.test === "HbA1c"));
  check("doctor sees schedule", (await call(docT, "GET", "/api/appointments")).json.appointments.length === 8);
  check("doctor page /doctor allowed", (await call(docT, "GET", "/doctor")).status === 200);

  section("Clinic ops (Tampines) must NOT see clinical data");
  for (const [m, p, b] of [
    ["GET", "/api/requests", undefined],
    ["GET", `/api/requests?id=${SHARE}`, undefined],
    ["GET", `/api/requests?id=${SHARE}&view=brief`, undefined],
    ["PATCH", "/api/requests", {}],
    ["POST", "/api/results", { shareId: SHARE, result: {} }],
    ["POST", "/api/extract-results", {}],
  ] as const) {
    check(`ops ${m} ${p} -> 403`, (await call(opsT, m, p, b)).status === 403);
  }
  for (const p of [`/doctor/brief?id=${SHARE}`, `/doctor/patient?id=${SHARE}`, "/requests", "/doctor", "/doctor/followups"]) {
    const r = await call(opsT, "GET", p);
    check(`ops page ${p} redirected away`, r.status >= 300 && r.status < 400 && r.location.endsWith("/clinic/home"), `${r.status} ${r.location}`);
  }
  const fu = await call(opsT, "GET", "/api/followups");
  check("ops follow-ups use only the generic label", fu.status === 200 && fu.json.items.length > 0 && fu.json.items.every((i: { test: string }) => i.test === "Follow-up"));
  check("ops follow-ups carry no results or clinical text", !CLINICAL.test(fu.text));
  const ap = await call(opsT, "GET", "/api/appointments");
  check("ops appointments list: logistics and change note only", ap.status === 200 && ap.json.appointments.every((a: object) => Object.keys(a).sort().join() === "change,date,flag,id,patientName,status,time"));
  check("ops appointments carry no clinical text", !CLINICAL.test(ap.text));
  const dash = await call(opsT, "GET", "/api/dashboard");
  check("ops dashboard allowed and aggregate only", dash.status === 200 && !/Mei Ling|Daniel/.test(dash.text));
  check("ops cannot mark a follow-up done", (await call(opsT, "PATCH", "/api/followups", { shareId: SHARE, followUpId: "seed-f2", action: "done" })).status === 403);
  const aud = await call(opsT, "GET", "/api/audit");
  check("ops clinic audit log allowed", aud.status === 200 && aud.json.shares.length === 8);
  check("ops audit log has no clinical text", !CLINICAL.test(aud.text));
  check("ops clinic profile allowed", (await call(opsT, "GET", "/api/clinic-profile")).json.clinic.id === "c-tampines");
  check("ops page /clinic allowed", (await call(opsT, "GET", "/clinic")).status === 200);

  section("Patient must NOT reach staff routes");
  for (const p of ["/api/requests", "/api/dashboard", "/api/appointments", "/api/followups", "/api/clinic-profile", "/api/results"]) {
    check(`patient ${p} -> 403`, (await call(patient, "GET", p)).status === 403);
  }
  for (const p of ["/doctor", "/clinic", "/requests", "/clinic/dashboard"]) {
    const r = await call(patient, "GET", p);
    check(`patient page ${p} redirected away`, r.status >= 300 && r.status < 400 && r.location.endsWith("/home"), `${r.status} ${r.location}`);
  }
  for (const p of ["/intake", "/choose-clinic"]) {
    check(`doctor page ${p} redirected`, (await call(docT, "GET", p)).status >= 300);
  }
  check("patient own audit allowed", (await call(patient, "GET", "/api/audit")).status === 200);

  section("Another clinic (Demo Clinic - Bedok) sees nothing from Tampines");
  // Bedok has its own seeded shares (s-seed-3 and s-bg-7..10). It must see some of those and nothing from Tampines (s-seed-1/2, s-bg-1..6).
  const tampinesIds = new Set(["s-seed-1", "s-seed-2", ...[1, 2, 3, 4, 5, 6].map((n) => `s-bg-${n}`)]);
  const own = (r: { id: string }[]) => r.length > 0 && r.every((x) => !tampinesIds.has(x.id));
  check("other doctor: only its own request", own((await call(docB, "GET", "/api/requests")).json.requests));
  check("other doctor: summary -> 404", (await call(docB, "GET", `/api/requests?id=${SHARE}`)).status === 404);
  check("other doctor: brief -> 404", (await call(docB, "GET", `/api/requests?id=${SHARE}&view=brief`)).status === 404);
  check("other doctor: only its own schedule", own((await call(docB, "GET", "/api/appointments")).json.appointments));
  check("other doctor: no Tampines follow-ups", (await call(docB, "GET", "/api/followups")).json.items.every((i: { shareId: string }) => !tampinesIds.has(i.shareId)));
  check("other doctor: cannot save findings", (await call(docB, "PATCH", "/api/requests", { id: SHARE, findings: {}, followUps: [] })).status !== 200);
  check("other ops: only its own appointments", own((await call(opsB, "GET", "/api/appointments")).json.appointments));
  check("other ops: cannot cancel Tampines appointment (404)", (await call(opsB, "PATCH", "/api/appointments", { shareId: SHARE, action: "cancel" })).status === 404);
  check("other ops: cannot remind on Tampines follow-up (404)", (await call(opsB, "PATCH", "/api/followups", { shareId: SHARE, followUpId: "seed-f2", action: "reminder" })).status === 404);
  // Bedok's dashboard counts only its own seeded records (5 live shares, 5 follow-ups, 1 no-show), never Tampines'.
  const bd = await call(opsB, "GET", "/api/dashboard");
  check("other ops: dashboard counts only its own seeded shares", bd.json.bookedAndShared === 5 && bd.json.followUps.total === 5 && bd.json.noShows === 1);
  const td = await call(opsT, "GET", "/api/dashboard");
  check("Tampines dashboard has its own numbers (7 live shares, 3 no-shows)", td.json.bookedAndShared === 7 && td.json.noShows === 3 && td.json.followUps.overdue >= 2 && td.json.prep.n >= 3 && td.json.teachBack.n >= 5);
  check("other ops: no Tampines audit entries", (await call(opsB, "GET", "/api/audit")).json.shares.every((x: { shareId: string }) => !tampinesIds.has(x.shareId)));
  check("other ops edits only their own clinic profile", (await call(opsB, "GET", "/api/clinic-profile")).json.clinic.id === "c-demo-bedok");

  section("Sharing rule: booked + consent + not cancelled/revoked/expired");
  check("ops cancels the appointment", (await call(opsT, "PATCH", "/api/appointments", { shareId: SHARE, action: "cancel" })).status === 200);
  check("cancelled: doctor no longer sees the patient", (await call(docT, "GET", "/api/requests")).json.requests.every((r: { id: string }) => r.id !== SHARE));
  check("cancelled: doctor summary -> 404", (await call(docT, "GET", `/api/requests?id=${SHARE}`)).status === 404);
  check("ops reschedules: booking is back", (await call(opsT, "PATCH", "/api/appointments", { shareId: SHARE, action: "reschedule", date: "2099-01-05", time: "09:00" })).status === 200);
  check("rescheduled: doctor sees the patient again", (await call(docT, "GET", `/api/requests?id=${SHARE}`)).status === 200);
  check("ops marks a no-show", (await call(opsT, "PATCH", "/api/appointments", { shareId: SHARE, action: "no_show" })).status === 200);
  check("patient revokes consent", (await call(patient, "DELETE", `/api/shares?id=${SHARE}`)).status === 200);
  check("revoked: doctor -> 404", (await call(docT, "GET", `/api/requests?id=${SHARE}`)).status === 404);
  check("revoked: ops can no longer manage it (404)", (await call(opsT, "PATCH", "/api/appointments", { shareId: SHARE, action: "cancel" })).status === 404);

  section("A patient's booking reaches the right clinic, and changes reflect");
  const siti = await signIn("u-siti");
  check("patient chooses Tampines", (await call(siti, "PATCH", "/api/profile", { clinicId: "c-tampines" })).status === 200);
  const D1 = "2099-03-10", D2 = "2099-03-12";
  // A patient's check is saved to the database (PUT /api/cases); sharing refers to it by id, never by content.
  const booking = (id: string, date: string, time: string) => ({ id, test: "Consultation with a doctor", dueDate: date, time, status: "booked", where: "Tampines Community Clinic", result: "", createdBy: "patient" });
  const sitiCase = { ...baseSnap, id: "case-siti", displayName: "Siti", followUps: [booking("siti-b1", D1, "09:15")], results: [], reports: [] };
  const saveCase = (who: Jar, c: object) => call(who, "PUT", "/api/cases", { case: c });
  check("patient's check is saved to the database", (await saveCase(siti, sitiCase)).status === 200);
  check("it comes back on the next load", (await call(siti, "GET", "/api/cases")).json.cases.some((c: { id: string }) => c.id === "case-siti"));
  check("another patient cannot read it", (await call(patient, "GET", "/api/cases")).json.cases.every((c: { id: string }) => c.id !== "case-siti"));
  check("another patient cannot overwrite it (404)", (await saveCase(patient, { ...sitiCase, followUps: [] })).status === 404);
  check("a doctor cannot use the cases API (403)", (await call(docT, "GET", "/api/cases")).status === 403 && (await saveCase(docT, sitiCase)).status === 403);
  check("clinic operations cannot use the cases API (403)", (await call(opsT, "GET", "/api/cases")).status === 403);
  const stale = await fetch(BASE + "/api/cases", { method: "PUT", headers: { "Content-Type": "application/json", cookie: siti.cookie, "x-cn-user": "u-someone-else" }, body: JSON.stringify({ case: sitiCase }) });
  check("a save queued by a different user is refused (409)", stale.status === 409);
  check("sharing needs consent", (await call(siti, "POST", "/api/shares", { consent: false, caseId: "case-siti", appointmentDate: D1 })).status === 400);
  check("sharing someone else's check is refused", (await call(patient, "POST", "/api/shares", { consent: true, caseId: "case-siti", appointmentDate: D1 })).status === 400);
  const shared = await call(siti, "POST", "/api/shares", { consent: true, caseId: "case-siti", appointmentDate: D1 });
  check("patient shares the booking with Tampines", shared.status === 200);
  const sid = shared.json?.shareId as string;
  const opsRows = (await call(opsT, "GET", "/api/appointments")).json.appointments as { id: string; date: string; time: string; status: string }[];
  check("Tampines ops sees the booking (date, time, status)", opsRows.some((a) => a.id === sid && a.date === D1 && a.time === "09:15" && a.status === "scheduled"));
  check("Tampines doctor sees the patient request", (await call(docT, "GET", "/api/requests")).json.requests.some((r: { id: string }) => r.id === sid));
  check("Bedok doctor does not", (await call(docB, "GET", "/api/requests")).json.requests.every((r: { id: string }) => r.id !== sid));
  check("Bedok ops does not", (await call(opsB, "GET", "/api/appointments")).json.appointments.every((a: { id: string }) => a.id !== sid));
  check("patient reschedules (by saving their check with the new date)", (await saveCase(siti, { ...sitiCase, followUps: [booking("siti-b1", D2, "11:00")] })).status === 200);
  const moved = ((await call(opsT, "GET", "/api/appointments")).json.appointments as { id: string; date: string; time: string }[]).find((a) => a.id === sid);
  check("ops sees the new date and time", moved?.date === D2 && moved?.time === "11:00");
  const snapNow = (await call(docT, "GET", "/api/requests?id=" + sid)).json.request.snapshot;
  type Row = { id: string; status: string; reportCount?: number; change: { kind: string; by: string; fromDate: string; unseen: boolean } | null };
  const rowFor = async (who: Jar) => ((await call(who, "GET", "/api/appointments")).json.appointments as Row[]).find((a) => a.id === sid);
  const dr = await rowFor(docT);
  check("doctor is told: rescheduled by patient, from the old date, not yet acknowledged", dr?.change?.kind === "rescheduled" && dr.change.by === "patient" && dr.change.fromDate === D1 && dr.change.unseen === true);
  check("ops is told the same", (await rowFor(opsT))?.change?.kind === "rescheduled");
  check("doctor presses Got it: cleared for the doctor, still new for ops", (await call(docT, "PUT", "/api/appointments", { shareId: sid })).status === 200 && (await rowFor(docT))?.change?.unseen === false && (await rowFor(opsT))?.change?.unseen === true);
  check("other-clinic doctor cannot acknowledge it (404)", (await call(docB, "PUT", "/api/appointments", { shareId: sid })).status === 404);
  check("a patient cannot use Got it (403)", (await call(siti, "PUT", "/api/appointments", { shareId: sid })).status === 403);
  check("doctor's copy of the booking moved too", snapNow.followUps.some((f: { dueDate: string }) => f.dueDate === D2) && !snapNow.followUps.some((f: { dueDate: string }) => f.dueDate === D1));
  check("patient sees the clinic's record", (await call(siti, "GET", "/api/shares")).json.shares.some((s: { id: string; appointmentDate: string }) => s.id === sid && s.appointmentDate === D2));
  check("patient cancels (by removing the booking from their check)", (await saveCase(siti, { ...sitiCase, followUps: [] })).status === 200);
  check("ops sees it cancelled", ((await call(opsT, "GET", "/api/appointments")).json.appointments as { id: string; status: string }[]).some((a) => a.id === sid && a.status === "cancelled"));
  check("doctor no longer sees a cancelled booking", (await call(docT, "GET", "/api/requests?id=" + sid)).status === 404);
  const dc = await rowFor(docT);
  check("doctor's schedule keeps a cancelled row: 'cancelled by patient', no report count", dc?.status === "cancelled" && dc.change?.kind === "cancelled" && dc.change.by === "patient" && dc.change.unseen === true && dc.reportCount === undefined);
  check("cancelled row grants no access to the patient (brief 404)", (await call(docT, "GET", "/api/requests?id=" + sid + "&view=brief")).status === 404);
  check("other-clinic doctor does not see the cancelled row", (await call(docB, "GET", "/api/appointments")).json.appointments.every((a: { id: string }) => a.id !== sid));

  section("Reports: patient uploads, shares, doctor sees it, patient un-shares");
  const D3 = "2099-05-04";
  const doc = (id: string, filename: string, kind: "lab" | "other", mimeType = "application/pdf") => ({ id, filename, content: "JVBERi0xLjQK", mimeType, kind, uploadedAt: new Date().toISOString() });
  const lab = doc("rep-lab", "hba1c-results.pdf", "lab");
  const other = doc("rep-other", "insurance-letter.pdf", "other");
  // A report is shared only while the patient has marked it shared: lab ticked, the other document left private.
  const repCase = (reports: object[]) => ({ ...sitiCase, id: "case-siti-r", followUps: [booking("siti-b2", D3, "09:15")], reports });
  await saveCase(siti, repCase([{ ...lab, shared: true }, { ...other, shared: false }]));
  const rs = await call(siti, "POST", "/api/shares", { consent: true, caseId: "case-siti-r", appointmentDate: D3 });
  check("patient shares the booking with the lab report ticked", rs.status === 200);
  const rid = rs.json?.shareId as string;
  const seen = async () => (await call(docT, "GET", `/api/requests?id=${rid}`)).json?.request?.snapshot?.reports as { id: string; content: string }[] | undefined;
  const first = await seen();
  check("doctor sees the shared lab report with its file", first?.length === 1 && first[0].id === "rep-lab" && first[0].content.length > 0);
  check("the unticked document is not revealed", !JSON.stringify((await call(docT, "GET", `/api/requests?id=${rid}`)).json).includes("rep-other"));
  check("patient's switches match what the clinic has", (await call(siti, "GET", "/api/shares")).json.shares.find((x: { id: string }) => x.id === rid)?.sharedReportIds?.join() === "rep-lab");
  check("the unshared document is still the patient's own, saved in the database", ((await call(siti, "GET", "/api/cases")).json.cases.find((c: { id: string }) => c.id === "case-siti-r")?.reports ?? []).length === 2);
  check("ops cannot open the request or its documents (403)", (await call(opsT, "GET", `/api/requests?id=${rid}`)).status === 403);
  check("ops schedule carries no documents", !(await call(opsT, "GET", "/api/appointments")).text.includes("JVBERi0x"));
  check("other-clinic doctor cannot see it (404)", (await call(docB, "GET", `/api/requests?id=${rid}`)).status === 404);
  check("other-clinic ops cannot open it (403)", (await call(opsB, "GET", `/api/requests?id=${rid}`)).status === 403);
  const sw = await saveCase(siti, repCase([{ ...lab, shared: true }, { ...other, shared: true }, { ...doc("rep-exe", "run.exe", "other", "application/x-msdownload"), shared: true }]));
  check("patient submits the other document too", sw.status === 200);
  check("doctor sees both; a disallowed file type is dropped", (await seen())?.map((r) => r.id).join() === "rep-lab,rep-other");
  check("patient withdraws everything", (await saveCase(siti, repCase([{ ...lab, shared: false }, { ...other, shared: false }]))).status === 200);
  check("doctor no longer sees any report", (await seen())?.length === 0);
  await saveCase(siti, repCase([{ ...lab, shared: true }]));
  await call(siti, "DELETE", `/api/shares?id=${rid}`);
  check("revoked consent: doctor gets 404 for the request and its report", (await call(docT, "GET", `/api/requests?id=${rid}`)).status === 404);

  section("Live sync: a patient's change reaches the doctor; consent changes remove it");
  const D4 = "2099-07-07";
  const liveCase = (over: object) => ({ ...sitiCase, id: "case-live", followUps: [booking("live-b1", D4, "10:00")], ...over });
  await saveCase(siti, liveCase({}));
  const live = await call(siti, "POST", "/api/shares", { consent: true, caseId: "case-live", appointmentDate: D4 });
  const lid = live.json?.shareId as string;
  type ReqRow = { id: string; flag: string | null; updatedAt: string };
  const listRow = async (who: Jar) => ((await call(who, "GET", "/api/requests")).json.requests as ReqRow[]).find((r) => r.id === lid);
  const opsFlag = async () => ((await call(opsT, "GET", "/api/appointments")).json.appointments as { id: string; flag: string | null }[]).find((a) => a.id === lid)?.flag;
  const logged = async () => ((await call(opsT, "GET", "/api/audit")).json.shares as { shareId: string; entries: unknown[] }[]).find((x) => x.shareId === lid)?.entries.length ?? 0;
  check("a new share is flagged 'new' for the doctor and for operations", (await listRow(docT))?.flag === "new" && (await opsFlag()) === "new");
  const polled = await call(docT, "GET", `/api/requests?id=${lid}&poll=1`);
  check("polling returns the share but logs nothing and marks nothing seen", polled.status === 200 && (await logged()) === 0 && (await listRow(docT))?.flag === "new");
  await call(docT, "GET", `/api/requests?id=${lid}`);
  check("opening it logs once and clears the doctor's flag", (await logged()) === 1 && (await listRow(docT))?.flag === null);
  check("operations still have their own unseen flag", (await opsFlag()) === "new");
  check("operations acknowledge it with Got it", (await call(opsT, "PUT", "/api/appointments", { shareId: lid })).status === 200 && (await opsFlag()) === null);

  // The patient edits history they have shared: a new relative and a new medicine, plus text and a dependant's medicine that must stay private.
  const edited = liveCase({
    rawHistory: "PRIVATE-TYPED-TEXT",
    summary: {
      ...baseSnap.summary,
      relatives: [...baseSnap.summary.relatives, { relation: "uncle", degree: 2, condition: "type 2 diabetes" }],
      medications: [...baseSnap.summary.medications, { name: "Metformin-LIVE", purpose: "", forWhom: "me" }, { name: "DAD-PRIVATE-PILL", purpose: "", forWhom: "dad" }],
    },
  });
  const before = (polled.json.request.snapshot.summary.relatives as unknown[]).length;
  await saveCase(siti, edited);
  const after = (await call(docT, "GET", `/api/requests?id=${lid}&poll=1`)).json.request;
  check("patient edits shared history: the doctor's row is flagged 'changed'", (await listRow(docT))?.flag === "changed");
  check("the doctor sees the new relative and medicine", after.snapshot.summary.relatives.length === before + 1 && JSON.stringify(after.snapshot.summary.medications).includes("Metformin-LIVE"));
  check("typed text and a dependant's medicine stay invisible", !JSON.stringify(after).includes("PRIVATE-TYPED-TEXT") && !JSON.stringify(after).includes("DAD-PRIVATE-PILL"));
  check("the response does not leak other users' viewing records", after.viewedBy === undefined);
  await call(docT, "GET", `/api/requests?id=${lid}&ack=1`);
  check("'Show changes' clears the flag without adding a log entry", (await listRow(docT))?.flag === null && (await logged()) === 1);
  await saveCase(siti, edited);
  check("saving the same content again raises no new flag", (await listRow(docT))?.flag === null);
  check("operations see the change as a schedule update only (no clinical fields)", ((await call(opsT, "GET", "/api/appointments")).text.match(/Metformin|relatives|PRIVATE/) ?? []).length === 0);
  check("operations cannot read the clinical request (403)", (await call(opsT, "GET", `/api/requests?id=${lid}`)).status === 403);
  check("the other clinic sees neither the row nor the share (404)", (await call(docB, "GET", "/api/requests")).json.requests.every((r: { id: string }) => r.id !== lid) && (await call(docB, "GET", `/api/requests?id=${lid}&poll=1`)).status === 404);
  await saveCase(siti, liveCase({ ...edited, followUps: [booking("live-b1", "2099-07-09", "10:00")] }));
  check("a reschedule flags operations and the doctor too", (await opsFlag()) === "changed" && (await listRow(docT))?.flag === "changed");
  await call(siti, "DELETE", `/api/shares?id=${lid}`);
  check("patient stops sharing: the doctor's poll gets 404 and the row is gone", (await call(docT, "GET", `/api/requests?id=${lid}&poll=1`)).status === 404 && !(await listRow(docT)));
  check("the booking disappears from operations too", ((await call(opsT, "GET", "/api/appointments")).json.appointments as { id: string }[]).every((a) => a.id !== lid));

  section("Role homes: each role has its own, protected on the server, read live from the database");
  const loc = (r: { location: string }) => r.location.replace(/^https?:\/\/[^/]+/, "");
  check("patient opening the doctor home is sent to /home", loc(await call(siti, "GET", "/doctor/home")) === "/home");
  check("patient opening the ops home is sent to /home", loc(await call(siti, "GET", "/clinic/home")) === "/home");
  check("doctor opening the patient home is sent to /doctor/home", loc(await call(docT, "GET", "/home")) === "/doctor/home");
  check("doctor opening the ops home is sent to /doctor/home", loc(await call(docT, "GET", "/clinic/home")) === "/doctor/home");
  check("ops opening the doctor home is sent to /clinic/home", loc(await call(opsT, "GET", "/doctor/home")) === "/clinic/home");
  check("a signed-out visitor is not shown a home", (await call(anon, "GET", "/home")).status >= 300 && (await call(anon, "GET", "/doctor/home")).status >= 300);
  check("each role opens its own home (200)", (await call(siti, "GET", "/home")).status === 200 && (await call(docT, "GET", "/doctor/home")).status === 200 && (await call(opsT, "GET", "/clinic/home")).status === 200);
  check("home APIs refuse the wrong role (403)", (await call(siti, "GET", "/api/doctor-home")).status === 403 && (await call(opsT, "GET", "/api/doctor-home")).status === 403 && (await call(docT, "GET", "/api/ops-home")).status === 403 && (await call(siti, "GET", "/api/ops-home")).status === 403);
  check("home APIs refuse a signed-out caller", (await call(anon, "GET", "/api/doctor-home")).status === 401 && (await call(anon, "GET", "/api/ops-home")).status === 401);

  // A patient shares a booking for later today: it must appear on both clinic homes, and only at that clinic.
  const today = sgToday();
  const homeCase = { ...sitiCase, id: "case-home", followUps: [booking("home-b1", today, "23:30")], reports: [] };
  await saveCase(siti, homeCase);
  const hs = await call(siti, "POST", "/api/shares", { consent: true, caseId: "case-home", appointmentDate: today });
  const hid = hs.json?.shareId as string;
  const dHome = async (who: Jar) => (await call(who, "GET", "/api/doctor-home")).json;
  const oHome = async (who: Jar) => (await call(who, "GET", "/api/ops-home")).json;
  const dh = await dHome(docT);
  check("doctor home: today's schedule lists the booking, and it is the next patient", dh.schedule.some((r: { id: string }) => r.id === hid) && dh.next?.id === hid);
  check("doctor home: request counts and the new-request count come from the database", dh.requests.total >= 1 && dh.requests.new >= 1);
  const boardItems = (await call(docT, "GET", "/api/followups")).json.items as { bucket: string }[];
  check("doctor home: overdue count equals the follow-up board's overdue items", dh.followUps.overdue === boardItems.filter((i) => i.bucket === "overdue").length);
  const oh = await oHome(opsT);
  check("ops home: today's appointments list the booking (name, time, status)", oh.todayRows.some((r: { id: string; time: string; status: string }) => r.id === hid && r.time === "23:30" && r.status === "scheduled"));
  const weekRows = ((await call(opsT, "GET", "/api/appointments")).json.appointments as { date: string; status: string }[]).filter((a) => a.status !== "cancelled" && a.date >= today && a.date <= addDays(today, 6));
  check("ops home: appointments this week equals the schedule's count", oh.week.appointments === weekRows.length);
  const dashJson = (await call(opsT, "GET", "/api/dashboard")).json;
  check("ops home: follow-ups done and overdue equal the dashboard's", oh.followUps.done === dashJson.followUps.done && oh.followUps.overdue === dashJson.followUps.overdue);
  check("ops home carries no clinical data", !/relative|medication|summary|snapshot|findings|result|report|brief|nudges|HbA1c|Metformin|rawHistory/i.test(JSON.stringify(oh)));
  check("the other clinic's homes do not show it", !(await dHome(docB)).schedule.some((r: { id: string }) => r.id === hid) && !(await oHome(opsB)).todayRows.some((r: { id: string }) => r.id === hid));
  await call(siti, "DELETE", `/api/shares?id=${hid}`);
  check("when the patient stops sharing it leaves both homes at once", !(await dHome(docT)).schedule.some((r: { id: string }) => r.id === hid) && !(await oHome(opsT)).todayRows.some((r: { id: string }) => r.id === hid));

  section("Seeded demo data is linked: patient, check, booking, report, clinic copy");
  const arjun = await signIn("u-arjun");
  const getCase = async (id: string) => (await call(arjun, "GET", "/api/cases")).json.cases.find((c: { id: string }) => c.id === id);
  const aCase = await getCase("seed-arjun");
  check("Arjun's seeded check is in the database with the booking his share follows", !!aCase?.followUps.some((f: { id: string }) => f.id === "seed-a1"));
  const arow = async () => ((await call(docB, "GET", "/api/appointments")).json.appointments as (Row & { date: string })[]).find((a) => a.id === "s-seed-3");
  const was = (await arow())?.date as string;
  const newDate = "2099-06-01";
  await saveCase(arjun, { ...aCase, followUps: aCase.followUps.map((f: { id: string }) => (f.id === "seed-a1" ? { ...f, dueDate: newDate } : f)) });
  const moved1 = await arow();
  check("Arjun moves his booking: Dr. Tan's schedule follows, noting the old date", moved1?.date === newDate && moved1?.change?.kind === "rescheduled" && moved1?.change?.fromDate === was);
  const movedByOps = "2099-06-09";
  const opsMove = await call(opsB, "PATCH", "/api/appointments", { shareId: "s-seed-3", action: "reschedule", date: movedByOps, time: "10:00" });
  const afterOps = await getCase("seed-arjun");
  check("Bedok ops move it: Arjun's own check is updated too", opsMove.status === 200 && afterOps.followUps.find((f: { id: string }) => f.id === "seed-a1").dueDate === movedByOps);
  await saveCase(arjun, { ...afterOps, displayName: "Arjun" });
  check("an unrelated save does not undo the clinic's move", (await arow())?.date === movedByOps);
  await saveCase(arjun, { ...afterOps, reports: [{ ...lab, id: "arjun-lab", shared: true }] });
  const reqB = await call(docB, "GET", "/api/requests?id=s-seed-3");
  check("Arjun submits a report: Dr. Tan's schedule counts it and the report opens", (await arow())?.reportCount === 1 && reqB.json.request.snapshot.reports[0].id === "arjun-lab");
  check("Tampines doctor cannot open it (404)", (await call(docT, "GET", "/api/requests?id=s-seed-3")).status === 404);
  await saveCase(arjun, { ...afterOps, followUps: [] });
  check("Arjun removes the future booking: the clinic's appointment is cancelled", (await arow())?.status === "cancelled");

  section("No record points at a removed clinic");
  const orphans = findOrphans(await readDb());
  check("no orphaned users, shares, documents or log entries", !orphans.users.length && !orphans.shares.length && !orphans.audit.length);

  section("Only two clinics exist");
  const list = (await call(anon, "GET", "/api/clinics")).json.clinics as { id: string }[];
  check("clinic list is exactly Tampines + Demo Clinic - Bedok", list.length === 2 && list.some((c) => c.id === "c-tampines") && list.some((c) => c.id === "c-demo-bedok"));
  check("patient cannot choose a removed clinic", (await call(patient, "PATCH", "/api/profile", { clinicId: "c-jurong" })).status !== 200);

  section("Sign-up rules");
  const s = jar();
  check("staff sign-up needs a clinic", (await call(s, "POST", "/api/auth", { name: "X", email: "x1@demo.test", role: "clinic_ops" })).status === 400);
  const newOps = await call(jar(), "POST", "/api/auth", { name: "New Ops", email: "newops@demo.test", role: "clinic_ops", clinicId: "c-demo-bedok" });
  check("ops sign-up stores role and clinic", newOps.json?.user?.role === "clinic_ops" && newOps.json.user.clinicId === "c-demo-bedok");
  check("removed clinic is rejected at sign-up", (await call(jar(), "POST", "/api/auth", { name: "N", email: "gone@demo.test", role: "doctor", clinicId: "c-jurong" })).status === 400);
  check("same email as another role -> 409", (await call(jar(), "POST", "/api/auth", { name: "N", email: "newops@demo.test", role: "doctor", clinicId: "c-demo-bedok" })).status === 409);
  check("same staff email at another clinic -> 409", (await call(jar(), "POST", "/api/auth", { name: "N", email: "newops@demo.test", role: "clinic_ops", clinicId: "c-tampines" })).status === 409);

  section("Reminders: a brand-new patient is reminded, sees it, and it is in the access logs");
  const fresh = jar();
  const reg = await call(fresh, "POST", "/api/auth", { name: "Test Patient", email: "test.patient@demo.test", role: "patient" });
  check("a new test patient signs up", reg.status === 200 && reg.json?.user?.role === "patient");
  await call(fresh, "PATCH", "/api/profile", { clinicId: "c-tampines" });
  const DR = "2099-08-08";
  const myBooking = { id: "tp-b1", test: "Consultation with a doctor", dueDate: DR, time: "09:00", status: "booked", where: "Tampines Community Clinic", result: "", createdBy: "patient" };
  const tpCase = { ...baseSnap, id: "case-test-patient", displayName: "Test Patient", followUps: [myBooking], results: [], reports: [] };
  await saveCase(fresh, tpCase);
  const tp = await call(fresh, "POST", "/api/shares", { consent: true, caseId: "case-test-patient", appointmentDate: DR });
  const tpid = tp.json?.shareId as string;
  check("the new patient books and shares with Tampines", tp.status === 200);
  const reminders = async () => ((await call(fresh, "GET", "/api/shares")).json.shares.find((x: { id: string }) => x.id === tpid)?.followUps ?? []) as { id: string; reminders?: string[] }[];
  const logOf = async (who: Jar) => ((await call(who, "GET", "/api/audit")).json.shares as { shareId: string; entries: { action: string; doctorName: string }[] }[]).find((x) => x.shareId === tpid)?.entries ?? [];
  check("ops send a reminder on the patient's own booking", (await call(opsT, "PATCH", "/api/followups", { shareId: tpid, followUpId: "tp-b1", action: "reminder" })).status === 200);
  check("the patient sees that reminder", ((await reminders()).find((f) => f.id === "tp-b1")?.reminders ?? []).length === 1);
  await saveCase(fresh, { ...tpCase, displayName: "Test Patient (edited)" });
  check("the reminder survives the patient saving their check", ((await reminders()).find((f) => f.id === "tp-b1")?.reminders ?? []).length === 1);
  check("it is in the ops access log", (await logOf(opsT)).some((x) => x.action === "sent_reminder" && x.doctorName === "Aisha (Ops)"));
  check("it is in the patient's own access log", (await logOf(fresh)).some((x) => x.action === "sent_reminder"));
  await call(docT, "GET", `/api/requests?id=${tpid}`);
  const plan = { id: "tp-plan", test: "HbA1c", dueDate: "2099-09-01", status: "planned", where: "", result: "", createdBy: "doctor" };
  const cur = (await call(docT, "GET", `/api/requests?id=${tpid}&poll=1`)).json.request.snapshot;
  await call(docT, "PATCH", "/api/requests", { id: tpid, findings: cur.findings, followUps: [...cur.followUps, plan] });
  check("the doctor reminds on their own follow-up plan", (await call(docT, "PATCH", "/api/followups", { shareId: tpid, followUpId: "tp-plan", action: "reminder" })).status === 200);
  check("the patient sees the doctor's plan with its reminder", ((await reminders()).find((f) => f.id === "tp-plan")?.reminders ?? []).length === 1);
  check("the access log lists both reminders", (await logOf(opsT)).filter((x) => x.action === "sent_reminder").length === 2);
  check("another clinic cannot remind this patient (404) and does not see the log entry", (await call(opsB, "PATCH", "/api/followups", { shareId: tpid, followUpId: "tp-b1", action: "reminder" })).status === 404 && (await logOf(opsB)).length === 0);

  section("Sessions survive a demo reset, and nothing live is cached");
  const kept = await signIn("u-arjun");
  await seed(); // what `npm run reset-demo` does
  check("a demo reset keeps signed-in browsers signed in (no silent 401s)", (await call(kept, "GET", "/api/cases")).status === 200 && (await call(await signIn("u-doc-1"), "GET", "/api/requests")).status === 200);
  const cached = await fetch(BASE + "/api/requests", { headers: { cookie: (await signIn("u-doc-2")).cookie } });
  check("API answers say Cache-Control: no-store", cached.headers.get("cache-control") === "no-store");

  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("Could not run the checks. Is the app running at " + BASE + "?\n", e);
  process.exit(2);
});
