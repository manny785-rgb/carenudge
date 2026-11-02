# CareNudge

Explainable, guideline-based diabetes screening nudges that a doctor reviews, plus LabelSpeak for reading medicine labels aloud in another language. Built for the Health & Social Sciences track. The product spec is in [../README.md](../README.md).

## Run it

```bash
npm install
cp .env.example .env.local   # then add ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

The app works without a key. In that case history is parsed by a keyword parser and the screen labels it that way, nudges keep the original rule wording, and LabelSpeak shows a "needs AI" message.

## Deploy (free)

1. Push this folder to GitHub.
2. In Vercel, choose **New Project**, import the repo, and set **Root Directory** to `carenudge` if the repo root is the hackathon folder.
3. Add the `ANTHROPIC_API_KEY` environment variable, plus `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (see **Database** below), then deploy. Without the Turso variables a deployed app has no persistent storage.

## What's built (against the PRD)

| PRD item | Where |
|---|---|
| Intake (blood-relative history + medicines, free text, any language) | `/intake` step 2 |
| Confirm screen: AI summary, editable, user must tick to confirm | `/intake` step 3 |
| Rules engine, diabetes pathway (JSON) | `src/lib/rules/diabetes.json`, `engine.ts` |
| Nudge cards with reason, rule ID, source quote + link | `src/components/NudgeCard.tsx` |
| Book a check (tracked) + share with doctor (link or same device) | `/intake` step 4 |
| Doctor view: summary, rules fired, exam findings, follow-up plan | `/doctor` |
| Follow-up tracker with overdue detection | `/doctor` (bottom) |
| Primary metric: teach-back check ("why?" and "what to do?") | `/intake` step 4 → `/metrics` |
| Secondary metric: doctor prep time | timed automatically in `/doctor/patient` |
| Nice to have: LabelSpeak, read-aloud, consent, delete | `/labelspeak`, 🔊 buttons, step 1, `/privacy` |

## Architecture

```
Browser (Next.js client pages; a patient's checks are saved to the database via /api/cases)
  ├─ /api/structure  → Claude: messy text → relatives/meds JSON (structured output)
  │                    fallback: offline keyword parser
  ├─ rules engine    → deterministic JSON rules decide nudges (runs in the browser, no AI)
  ├─ /api/explain    → Claude: reword nudges in plain English/中文/Melayu/தமிழ்
  │                    (can't add, drop or change nudges; output filtered by rule ID)
  └─ /api/label      → Claude vision: label photo → transcription + translation
browser speechSynthesis → read-aloud
```

**AI role.** The AI structures text, rewrites wording and reads labels. It never decides what gets flagged. The rules engine does that, and the same confirmed summary always gives the same nudges.

**Responsible-AI controls.**
- The user must confirm the AI summary before any rule runs.
- Every nudge shows its rule ID, a source quote and a link.
- The app never diagnoses and never gives an all-clear. When no rule fires, it shows an explicit "not an all-clear" notice.
- Uncertain extractions are listed for the user to check.
- Prompts forbid guessing doses or medical facts.
- A patient's checks are saved to their account in the database. A clinic's copy (a share) is derived from the check and exists only after the patient books there and consents; it is re-derived on every save, so it cannot drift, and the patient can revoke it or delete everything in one click.
- API calls use server-side refusal fallbacks (`fallbacks: "default"`). Any AI failure falls back to deterministic output.

## Database

Requests, shares, users, clinic profiles, the access log and teach-back answers are stored in a SQL database, so a patient's booking and share show up for the right clinic's operations staff and doctors (and only them). The data layer is `src/lib/dbstore.ts`: real tables (`users`, `clinics`, `shares`, `audit`, `teach_back`, `meta`) with row-level writes. The app reads and writes through `readDb` / `writeDb` in `src/lib/db.ts`.

- **Local development: no setup.** With no Turso variables, the app uses a local SQLite file, `data/carenudge.db` (created and seeded automatically, not committed).
- **Hosted (free): Turso.** Create a free account and database, then set these in `.env.local` (and in your host's environment variables when deploying):

  ```
  TURSO_DATABASE_URL=libsql://<your-database>.turso.io
  TURSO_AUTH_TOKEN=<token>
  ```

  With the Turso CLI: `turso db create carenudge`, `turso db show carenudge --url`, `turso db tokens create carenudge`. Tables are created on first use and the demo data is seeded automatically when the database is empty.
- **Reset the demo data** (users, shares, access log) at any time: `npm run reset-demo`. It resets whichever database the variables point to.
- Fake data only. This is a hackathon prototype: the sign-in is a demo, and the app loads the whole (small) database per request.

## Demo sign-in, roles and sharing

**Demo sign-in - no real accounts.** There are no passwords and nothing is verified: anyone can sign up as any role with any name and email. It demonstrates the access rules; real use would need real identity checks. The session is a signed httpOnly cookie holding only a user id. The role and clinic are read from the database on every request. All data is fake.

**Sign-up flow:** Step 1 *I'm a patient* or *I'm from a clinic*. Clinic staff then pick **Operations** or **Doctor**, then their clinic (fixed once chosen). Home → **For clinics** starts that flow. After sign-in each role lands on its own home: patient → `/home` (or the clinic picker first), doctor → `/doctor/home`, ops → `/clinic/home`. The logo links to your own home, and another role's home redirects you to yours. The schedule and appointments lists stay at `/doctor` and `/clinic`. The doctor and ops homes read `/api/doctor-home` and `/api/ops-home`; the ops one returns names, times, statuses and counts only.

### Demo logins (use *Switch to a demo user* on the sign-up page, or type the email)

| Role | Name | Email | Clinic |
|---|---|---|---|
| Patient | Mei Ling | meiling@demo.test | Tampines (has a shared summary, overdue follow-up, results) |
| Patient | Daniel | daniel@demo.test | Tampines (a no-show appointment) |
| Patient | Arjun | arjun@demo.test | Demo Clinic - Bedok (a shared booking in 5 days) |
| Patient | Siti | siti@demo.test | none yet |
| Doctor | Dr. Rahman | doctor2@demo.test | Tampines Community Clinic |
| Clinic ops | Aisha | ops.tampines@demo.test | Tampines Community Clinic |
| Doctor | Dr. Tan | doctor1@demo.test | Demo Clinic - Bedok |
| Clinic ops | Ben | ops.bedok@demo.test | Demo Clinic - Bedok |

### Clinics (demo)

The demo has exactly two clinics, both fictional and labelled *Demo data*: **Tampines Community Clinic** and **Demo Clinic - Bedok**. The full list of 12 stays in `CLINICS` in `src/lib/clinics.ts`; every clinic except those two has `active: false`, and only active clinics are seeded, shown in the picker, or accepted at sign-up. To bring one back, delete its `active: false` line (or set it to true) and re-seed.

**Reset and re-seed:** stop the dev server, run `npm run reset-demo`, then restart. This replaces everything in the database (including accounts you signed up) with the seed. The dashboards are computed from the seeded shares, follow-ups and no-shows at each clinic.

### Who can do what

| | Patient | Doctor | Clinic ops |
|---|---|---|---|
| Own check, symptoms, reports, LabelSpeak, clinic choice, "who has seen my summary", revoke | yes | no | no |
| Schedule / appointments | no | read-only | reschedule, cancel, mark no-show |
| Patient requests, summary, family history, medicines | no | yes (consented, booked, not revoked/expired/cancelled) | **no** |
| Pre-visit brief, exam findings, results and trends, care plan | no | yes | **no** |
| Follow-ups | no | clinical (test name), mark done, reschedule, demo reminder | logistics only (generic "Follow-up" label), reschedule, demo reminder |
| Clinic dashboard (aggregates) | no | **no** | yes |
| Clinic profile and hours | no | **no** | yes |
| Clinic access log | no | **no** | yes |
| Listing / subscription | no | no | placeholder (no payments) |

Enforced on the server: `src/proxy.ts` runs first (signed-out → sign-in, wrong role → redirect for pages or 401/403 for `/api/*`, from the table in `src/lib/roles.ts`), and **every API route re-checks** the role and scopes queries to the signed-in user's own clinic (`requireUser` / `requireStaff`, `shareForDoctor` / `shareForOps` in `src/lib/db.ts`). Another clinic's data returns 404. Hiding nav links is only a convenience.

**Test it:** start the app, then `npm run test:access` (set `BASE_URL` if it isn't on port 3000). It resets the demo data, tries about 100 forbidden and allowed accesses across all roles, and prints PASS/FAIL.

### Sharing

- A summary reaches a clinic only if the patient books an appointment **with that clinic** and ticks an explicit consent box after seeing exactly what will be sent (confirmed summary and nudges; never the typed text, uploaded reports, or medicines for people they care for). One live share per patient per clinic.
- Patients can revoke at any time (**My data**). Changing clinic revokes the old clinic's share. Shares expire `SHARE_WINDOW_DAYS` (30) after the appointment. A cancelled appointment hides the patient from the doctor.
- Persistence: a SQL database (see **Database**). A patient's own checks (history, bookings, reports) are rows in the `cases` table, owned by their account and never readable by a clinic. A share is the clinic's sanitised copy, re-derived from the check each time it is saved (a moved booking reschedules it, a removed future booking cancels it, a submitted report is added). Only the prototype's test metrics stay in the browser.
- **Appointments** (`/appointments`, patients): your bookings (upcoming and earlier) with reschedule and cancel. For a booking you shared, it also shows the clinic's record (including a clinic cancel, reschedule or no-show), and cancel or reschedule updates the clinic's schedule. A booking you have not shared is saved to your account only: the clinic does not receive it until you share with consent. Doctors and operations see a change note on the schedule ("Cancelled by patient", "Rescheduled by patient, was 2026-11-05 at 15:00") with a "New change" marker until they press "Got it". A cancelled row shows logistics only: no patient summary, brief or reports. No emails or push alerts are sent.
- **Live updates** (doctor and operations): the schedule and the patient-requests list refresh every 12 seconds and when the tab is shown, with an "Updated just now / x min ago" label. A row shows **New request** or **New changes** until the doctor opens it (or operations press **Got it**). An open patient page offers **Show changes** instead of replacing the form, so unsaved edits are never lost; if the patient stops sharing, the page switches to "Access has ended". Polling is not written to the access log; only opening a patient is.
- Clinic list: **Use my location** (only when tapped) sorts by distance; coordinates stay in the browser's memory and are never saved or sent. Fallback: postal code or area. Each clinic shows "Open now / Closed, opens …" in Singapore time. When no nearby clinic is open, a card lists 24-hour emergency departments (`src/lib/emergency.ts`) with the fixed notice: CareNudge does not assess symptoms; if you feel unwell, call 995 or go to A&E. Check that file's details before a public demo.

### Doctor tools

- **Patient requests** (`/requests`) and **Schedule** (`/doctor`), with **View brief**: a one-page printable pre-visit brief (family history, medicines, last tests, nudges with rule ID and source, 3 to 5 neutral questions for the doctor to consider).
- **Follow-ups** (`/doctor/followups`): Overdue / Due this week / Upcoming / Done in Singapore time. Reminders are simulated: nothing is sent, and the patient sees "Reminder sent (demo)".
- **Test results**: the doctor enters values (or confirms an AI draft read from a report photo) with a trend chart showing the range *printed on the report*. Values are tagged doctor-confirmed or patient-reported.

### Clinic operations tools

- **Appointments** (`/clinic`): name, time and status only. **Follow-ups** (`/clinic/followups`): logistics only. **Dashboard** (`/clinic/dashboard`): counts from this clinic's consented shares, labelled "Demo data - not real clinic results". **Clinic profile** (`/clinic/profile`): hours, services, languages, address, phone (the patient list and "Open now" read from it). **Access log** (`/clinic/audit`): who opened which summary or brief, with consent status and expiry; after a revoke the clinic keeps its own access history but loses the summary. **Listing** (`/clinic/listing`): placeholder.

## Demo script (about 3 min)

1. Home → **Start my check**. Sign up as a patient (any name/email) and choose **Tampines Community Clinic**.
2. In `/intake`, accept consent and load the **Mei Ling** persona. Choose **Turn this into a summary**.
3. On the confirm screen, point out that dad's metformin is marked as *someone else's* medicine. Tick the box and confirm.
4. Show the **DM-AGE40** nudge with its reason and source. Choose **Explain in plain words** and switch to Chinese, then use 🔊.
5. Answer the teach-back check, book a date and time (at your clinic), then **Share with Tampines…**: review what is sent, tick consent, share.
6. Switch to **Dr. Rahman** (Tampines): **Schedule** and **Patient requests** show the patient. Open the brief, enter an HbA1c, add a follow-up.
7. Switch to **Aisha (Ops)**: appointments and follow-up logistics with no health details. Reschedule or cancel (the doctor loses a cancelled patient), and open the dashboard and access log.
8. Switch to **Dr. Tan** or **Ben (Ops)** at Demo Clinic - Bedok: they see only Arjun's booking, nothing from Tampines. Try opening `/clinic` as a doctor: you are redirected.
9. Show **Daniel**, 29 with no history: a "not an all-clear" notice instead of a green tick.
10. `/labelspeak` (as a patient): photograph a medicine box, translate it to Malay, and read it aloud.

`npx tsx scripts/check-personas.ts` prints what each persona triggers.

## Before you demo: verify the citations

The rule thresholds follow Singapore Screen for Life guidance (diabetes screening every 3 years from 40, plus a risk assessment for ages 18–39), the Asian BMI cut-off of 23, and the ADA guidance on gestational diabetes. **The `quote` text in `diabetes.json` is paraphrased.** Open each URL and replace the quote with the exact wording, or fix the link, before showing it publicly.

## Limitations

- Covers only the diabetes pathway. It isn't a medical device and hasn't been clinically validated.
- Sign-in is a demo (no real accounts or passwords).
- The offline parser is basic. The confirm screen is the safety net.

## Design and themes

A "clinical but fun" look: crisp white and cool pale-grey surfaces with deep ink-navy text in light mode, navy-charcoal surfaces with soft off-white text in dark mode, one vivid indigo accent and a small coral highlight. Headings use Bricolage Grotesque and body text Figtree (via `next/font`).

- **Tokens:** every colour is a CSS variable in `src/styles/tokens.css` (light and dark values side by side), exposed to Tailwind as `bg-surface`, `text-muted`, `border-line`, `bg-accent`, and so on. Components never hard-code a colour. Shared look-and-feel classes (`card`, `btn-*`, `input`, `chip`, `tone-*`, `urgent`) live in `src/app/globals.css`.
- **Theme switch:** light, dark or system, in the account menu (and as a button on the signed-out header). The choice is remembered in `localStorage`; a small inline script in `<head>` (`src/lib/theme.ts`) applies it before the first paint, so there is no flash of the wrong theme.
- **Icons:** one inline line-icon set in `src/components/ui/Icon.tsx` (no icon dependency, no emoji).
- **Motion:** cards rise in, the stepper fills, ticks draw themselves, the main button pulses gently and a waveform plays during read-aloud. All of it stops under `prefers-reduced-motion`.
- **Safety wording:** the urgent-symptom banner and "Not a diagnosis" use the `urgent` / `not-diagnosis` classes with their own high-contrast pair in both themes.
- **Contrast check:** `npm run check:contrast` tests every text and background pairing in both themes against WCAG AA.
