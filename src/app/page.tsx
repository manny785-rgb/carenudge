import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";

// Signed-out landing page. One focal element (the headline and its button); everything else is quieter.
const TRUST: { icon: IconName; title: string; text: string }[] = [
  { icon: "clipboard", title: "Rules decide, not AI", text: "Flagged from fixed guidelines with cited sources." },
  { icon: "check", title: "You confirm first", text: "Review your summary before any nudge." },
  { icon: "lock", title: "Your data, your choice", text: "Saved to your account. Shared only with consent. Delete anytime." },
];

export default function Home() {
  return (
    <div className="space-y-14">
      {/* Hero: left-aligned, with a short "how it works" list beside it on wide screens */}
      <section className="grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <span className="chip tone-play">Screening, explained</span>
          <h1 className="font-display text-4xl leading-[1.05] font-bold text-ink sm:text-6xl">
            Get screened earlier—with nudges that <span className="text-accent-text">explain themselves.</span>
          </h1>
          <p className="max-w-xl text-xl text-muted">
            CareNudge turns your family history into personal, guideline-based screening reminders that a doctor reviews.
          </p>
          <Link href="/signup?role=patient" className="btn-primary pulse-soft inline-flex px-8 py-4 text-lg">
            Start my check
          </Link>
        </div>
        <ol className="card space-y-4 !p-6">
          {["Tell us your family history", "Confirm the summary yourself", "See your nudge, its reason and its source"].map((t, i) => (
            <li key={t} className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft font-display font-bold text-accent-text">{i + 1}</span>
              <span className="pt-0.5 text-ink">{t}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Patients and clinics: the patient path is the loud one, the clinic path is quieter */}
      <section className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
        <div className="card space-y-3 !border-accent/40 !bg-accent-soft">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface text-accent-text"><Icon name="heart" className="h-6 w-6" /></span>
            <h2 className="font-display text-2xl font-bold text-ink">For you</h2>
          </div>
          <p className="text-ink">
            Tell us your family history, get a personalized nudge with its reason and source. No scary symptom searches. No diagnosis. No false all-clear.
          </p>
          <Link href="/signup?role=patient" className="btn-primary">Start a check</Link>
        </div>
        <div className="card space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-raised text-muted"><Icon name="users" className="h-6 w-6" /></span>
            <h2 className="font-display text-2xl font-bold text-ink">For clinics</h2>
          </div>
          <p className="text-muted">
            Doctors review summaries from patients who booked and chose to share, and set follow-up plans. Operations staff manage appointments and follow-up logistics.
          </p>
          <Link href="/signup?who=clinic" className="btn-secondary">Sign in for clinics</Link>
        </div>
      </section>

      {/* Why it matters: a strip of numbers, the coral is the one playful touch */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold text-ink">Why this matters</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["49%", "of adults aged 21–75 had a health checkup or screening in the past 12 months"],
            ["63.4%", "have up-to-date diabetes screening"],
            ["−28%", "lower uptake when people feel a lack of control"],
          ].map(([n, t]) => (
            <div key={n} className="border-l-4 border-play pl-4">
              <p className="font-display text-4xl font-bold text-ink">{n}</p>
              <p className="text-sm text-muted">{t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust: a plain list, not another row of cards */}
      <section className="divide-y divide-line rounded-[20px] border border-line bg-surface">
        {TRUST.map((t) => (
          <div key={t.title} className="flex items-start gap-4 p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-raised text-accent-text"><Icon name={t.icon} className="h-5 w-5" /></span>
            <div>
              <h3 className="font-semibold text-ink">{t.title}</h3>
              <p className="text-sm text-muted">{t.text}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
