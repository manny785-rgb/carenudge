import Link from "next/link";

// Placeholder only. No payment, subscription or listing logic exists in this demo.
export default function ListingPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-display text-3xl font-bold text-accent-text">Clinic listing</h1>
      <div className="card space-y-2">
        <p className="font-semibold">Coming later</p>
        <p className="text-muted">
          Settings for how your clinic is listed to patients, and any listing plan, will live here. This is a placeholder: nothing can be
          bought, subscribed to or paid for in this demo, and no payment details are collected.
        </p>
        <p className="text-sm text-muted">
          For now, every demo clinic appears in the patient clinic list. Edit what patients see on the{" "}
          <Link className="underline" href="/clinic/profile">Clinic profile</Link> page.
        </p>
      </div>
    </div>
  );
}
