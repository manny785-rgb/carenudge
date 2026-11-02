import { z } from "zod";

// Shared request-body schemas for doctor routes.

export const FollowUpSchema = z.object({
  id: z.string(),
  test: z.string().max(100),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["planned", "booked", "done", "missed"]),
  where: z.string().max(100),
  result: z.string().max(200),
  createdBy: z.enum(["patient", "doctor"]),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  doneDate: z.string().optional(),
  reminders: z.array(z.string()).optional(),
});

export const TestResultSchema = z.object({
  id: z.string(),
  test: z.string().trim().min(1).max(60),
  value: z.number().finite(),
  unit: z.string().max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rangeLow: z.number().finite().nullable(),
  rangeHigh: z.number().finite().nullable(),
  reportId: z.string().max(64).optional(),
});

const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Weekly opening hours: all 7 days (0 = Sunday), each a list of [open, close] periods. */
export const HoursSchema = z
  .record(z.string().regex(/^[0-6]$/), z.array(z.tuple([Time, Time])).max(3))
  .refine((h) => Object.keys(h).length === 7, "All 7 days are required")
  .refine((h) => Object.values(h).every((ps) => ps.every(([o, c]) => o < c)), "Closing must be after opening");

export const ClinicProfileSchema = z.object({
  hours: HoursSchema,
  services: z.array(z.string().trim().min(1).max(60)).max(12),
  languages: z.array(z.string().trim().min(1).max(30)).min(1).max(8),
  address: z.string().trim().max(150),
  phone: z.string().trim().max(30),
});

