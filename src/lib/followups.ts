import { addDays } from "./sgtime";

export type Bucket = "overdue" | "due_week" | "upcoming" | "done";

/** "Overdue" is decided from today's date in Asia/Singapore. Missed visits stay in Overdue. */
export function bucketOf(status: string, due: string, today: string): Bucket {
  if (status === "done") return "done";
  if (status === "missed" || due < today) return "overdue";
  return due <= addDays(today, 7) ? "due_week" : "upcoming";
}
