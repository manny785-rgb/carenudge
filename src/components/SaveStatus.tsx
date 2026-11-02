"use client";

import { useSaveFailing } from "@/lib/storage";
import { Icon } from "@/components/ui/Icon";

/** Shown only while a save to the database is failing, so a change never silently fails to reach the clinic. */
export function SaveStatus() {
  const failing = useSaveFailing();
  if (!failing) return null;
  return (
    <div role="alert" className="sticky top-[57px] z-10 border-b border-warn-line bg-warn-soft px-4 py-2 text-center text-sm font-semibold text-warn">
      <Icon name="alert" className="mr-1 inline h-4 w-4" />
      Your latest changes are not saved yet. Retrying… If this stays, restart the app server and sign in again.
    </div>
  );
}
