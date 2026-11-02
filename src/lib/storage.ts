"use client";

import { useSyncExternalStore } from "react";
import type { CareCase, DoctorFindings, PrepRecord, TeachBackRecord } from "./types";

// A patient's saved checks live in the database (see /api/cases), under their account, so their
// bookings, reports and shares are all one linked record. This module keeps a copy in memory so
// pages stay instant: reads are synchronous, writes update the copy at once and are saved to the
// server a moment later (or immediately with saveNow). Clinics never read a check directly: they
// see a share, which the server re-derives from the check on every save.
//
// Only the prototype's own test metrics (teach-back and prep timings) stay in this browser.

interface Store {
  cases: CareCase[];
  teachBack: TeachBackRecord[];
  prep: PrepRecord[];
}

let userId: string | null = null;
let cases: CareCase[] = [];
let metrics = { teachBack: [] as TeachBackRecord[], prep: [] as PrepRecord[] };
let loaded = false;
let view: Store | null = null; // stable object for useSyncExternalStore; rebuilt on every change

let saveFailing = false; // the last save to the database did not go through
const SAVE_DELAY_MS = 300;
const RETRY_MS = 5000;
const pending = new Map<string, { c: CareCase; owner: string | null }>(); // saves not yet sent, with who made them
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const listeners = new Set<() => void>();
function emit() {
  view = loaded ? { cases, ...metrics } : null;
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const metricsKey = () => `carenudge:v2:${userId}:metrics`;
function readMetrics() {
  try {
    const m = JSON.parse(localStorage.getItem(metricsKey()) ?? "{}");
    metrics = { teachBack: m.teachBack ?? [], prep: m.prep ?? [] };
  } catch {
    metrics = { teachBack: [], prep: [] };
  }
}
function writeMetrics() {
  try {
    localStorage.setItem(metricsKey(), JSON.stringify(metrics));
  } catch {
    /* storage blocked: metrics are optional */
  }
  emit();
}

/** The owner header lets the server refuse a save that was queued by a different user than the one now signed in. */
async function send(c: CareCase, owner: string | null, keepalive = false): Promise<boolean> {
  try {
    const res = await fetch("/api/cases", { method: "PUT", headers: { "Content-Type": "application/json", ...(owner ? { "x-cn-user": owner } : {}) }, body: JSON.stringify({ case: c }), keepalive });
    setSaveFailing(!res.ok);
    // Signed out (401) or queued by someone else (409): retrying cannot help, so only transient failures are retried.
    if (!res.ok && res.status !== 401 && res.status !== 409 && res.status !== 400 && !keepalive) retryLater(c, owner);
    return res.ok;
  } catch {
    setSaveFailing(true);
    if (!keepalive) retryLater(c, owner);
    return false;
  }
}

function setSaveFailing(v: boolean) {
  if (v !== saveFailing) {
    saveFailing = v;
    listeners.forEach((l) => l());
  }
}

/** True while the latest save to the database has failed (it is being retried). Drives the "not saved" banner. */
export function useSaveFailing(): boolean {
  return useSyncExternalStore(subscribe, () => saveFailing, () => false);
}

/** A save that failed for a passing reason (network, server hiccup) goes back in the queue and is tried again shortly. */
function retryLater(c: CareCase, owner: string | null) {
  if (pending.has(c.id)) return; // a newer edit is already queued
  pending.set(c.id, { c, owner });
  timers.set(c.id, setTimeout(() => flushSaves(), RETRY_MS));
}

/** Save a check right now and wait for the server. Use it when the next step depends on the clinic's copy being current. */
export async function saveNow(c: CareCase): Promise<boolean> {
  putLocal(c);
  clearTimeout(timers.get(c.id));
  timers.delete(c.id);
  pending.delete(c.id);
  return send(c, userId);
}

/** Send every unsaved check (page hide, sign-out, switching user). */
export function flushSaves(keepalive = false): Promise<boolean[]> {
  const jobs = [...pending.values()].map(({ c, owner }) => {
    clearTimeout(timers.get(c.id));
    timers.delete(c.id);
    pending.delete(c.id);
    return send(c, owner, keepalive);
  });
  return Promise.all(jobs);
}

async function fetchCases(): Promise<CareCase[] | null> {
  try {
    const res = await fetch("/api/cases", { cache: "no-store" });
    return res.ok ? ((await res.json()).cases as CareCase[]) : null;
  } catch {
    return null;
  }
}

/** Older versions kept checks in this browser. Copy any the server doesn't have, once, so nothing is lost. */
async function importBrowserCopies(forUser: string, onServer: Set<string>) {
  try {
    const flag = `carenudge:v1:${forUser}:imported`;
    if (localStorage.getItem(flag)) return;
    const old = JSON.parse(localStorage.getItem(`carenudge:v1:${forUser}`) ?? "{}") as { cases?: CareCase[] };
    for (const c of old.cases ?? []) if (c?.id && !onServer.has(c.id) && (await send(c, forUser))) cases = [c, ...cases];
    localStorage.setItem(flag, "1");
  } catch {
    /* nothing to import */
  }
}

async function loadFromServer(forUser: string) {
  const fetched = await fetchCases();
  if (userId !== forUser) return; // the user changed while we were loading
  cases = fetched ?? [];
  readMetrics();
  loaded = true;
  emit();
  if (fetched) {
    await importBrowserCopies(forUser, new Set(fetched.map((c) => c.id)));
    if (userId === forUser) emit();
  }
}

/** Called by the session when the signed-in user changes. Only patients have checks; others pass null. */
export function setStorageUser(next: string | null) {
  if (next === userId && loaded) return;
  flushSaves(true);
  userId = next;
  cases = [];
  metrics = { teachBack: [], prep: [] };
  loaded = next === null; // no patient, nothing to load
  emit();
  if (next) loadFromServer(next);
}

// Pick up changes made elsewhere (the clinic moved the appointment, another device) when the tab is shown again.
if (typeof window !== "undefined") {
  const refresh = async () => {
    if (!userId || !loaded || pending.size) return;
    const fetched = await fetchCases();
    if (fetched && !pending.size) {
      cases = fetched;
      emit();
    }
  };
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", () => (document.visibilityState === "hidden" ? flushSaves(true) : refresh()));
  window.addEventListener("pagehide", () => flushSaves(true));
}

/** Reactive view of the store. null until the patient's checks have loaded. */
export function useStore(): Store | null {
  return useSyncExternalStore(subscribe, () => view, () => null);
}

/** True once the patient's checks have loaded (pages wait for this before deciding there is nothing saved). */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => loaded, () => false);
}

export function load(): Store {
  return { cases, ...metrics };
}

export function getCase(id: string) {
  return cases.find((c) => c.id === id) ?? null;
}

function putLocal(c: CareCase) {
  const i = cases.findIndex((x) => x.id === c.id);
  cases = i >= 0 ? cases.map((x, j) => (j === i ? c : x)) : [c, ...cases];
  emit();
}

/** Save a check: the in-memory copy changes now, the server a moment later. */
export function upsertCase(c: CareCase) {
  putLocal(c);
  pending.set(c.id, { c, owner: userId });
  clearTimeout(timers.get(c.id));
  timers.set(c.id, setTimeout(() => flushSaves(), SAVE_DELAY_MS));
}

export function deleteCase(id: string) {
  pending.delete(id);
  clearTimeout(timers.get(id));
  cases = cases.filter((c) => c.id !== id);
  metrics = { teachBack: metrics.teachBack.filter((t) => t.caseId !== id), prep: metrics.prep.filter((p) => p.caseId !== id) };
  writeMetrics();
  fetch(`/api/cases?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
}

const PURGE_AFTER_DAYS = 7;

/** Removes follow-ups/appointments whose date was more than a week ago. */
export function purgeExpiredFollowUps() {
  const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * 86_400_000).toISOString().slice(0, 10);
  for (const c of cases) {
    const kept = c.followUps.filter((f) => !f.dueDate || f.dueDate >= cutoff);
    if (kept.length !== c.followUps.length) upsertCase({ ...c, followUps: kept });
  }
}

/** Delete all of this patient's checks (and stop every share of them). */
export function deleteEverything() {
  pending.clear();
  timers.forEach(clearTimeout);
  timers.clear();
  cases = [];
  metrics = { teachBack: [], prep: [] };
  try {
    localStorage.removeItem(metricsKey());
  } catch {}
  emit();
  fetch("/api/cases?all=1", { method: "DELETE" }).catch(() => {});
}

export function recordTeachBack(r: TeachBackRecord) {
  metrics = { ...metrics, teachBack: [...metrics.teachBack, r] };
  writeMetrics();
}

export function recordPrep(r: PrepRecord) {
  metrics = { ...metrics, prep: [...metrics.prep, r] };
  writeMetrics();
}

export const newId = () => Math.random().toString(36).slice(2, 10);

export const emptyFindings = (): DoctorFindings => ({
  bpSys: "",
  bpDia: "",
  bmi: "",
  hba1c: "",
  fastingGlucose: "",
  notes: "",
  reviewedAt: null,
});
