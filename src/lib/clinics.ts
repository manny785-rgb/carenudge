// Fictional demo clinics. Not real places.

/** Opening periods per weekday (0 = Sunday ... 6 = Saturday), "HH:MM" in Singapore time. An empty list means closed all day. */
export type OpeningHours = Record<number, [string, string][]>;

export interface Clinic {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  hours: OpeningHours;
  languages: string[];
  services: string[];
  /** Optional contact details, entered by the clinic's own doctors. Never pre-filled with invented details. */
  address?: string;
  phone?: string;
  /** True for the fictional seed clinics. */
  demo?: boolean;
  /** Only active clinics are seeded. Set to false (or omit from the seed) to hide a clinic; flip back to restore it. Default: active. */
  active?: boolean;
}

const WEEKDAY: [string, string][] = [["09:00", "21:00"]];
const LONG: [string, string][] = [["08:00", "22:00"]];
const SPLIT: [string, string][] = [["08:30", "12:30"], ["14:00", "18:00"]]; // lunch break
const DAY: [string, string][] = [["09:00", "19:00"]];

export const CLINICS: Clinic[] = [
  {
    id: "c-bukit-merah",
    active: false,
    name: "Bukit Merah Family Clinic",
    area: "Bukit Merah",
    lat: 1.2819,
    lng: 103.8239,
    hours: { 0: [], 1: WEEKDAY, 2: WEEKDAY, 3: WEEKDAY, 4: WEEKDAY, 5: WEEKDAY, 6: [["09:00", "13:00"]] },
    languages: ["English", "Mandarin"],
    services: ["Diabetes screening (blood test)", "Healthier SG enrolment", "Blood pressure check"],
  },
  {
    id: "c-tampines",
    name: "Tampines Community Clinic",
    area: "Tampines",
    lat: 1.3496,
    lng: 103.9568,
    hours: { 0: [["09:00", "13:00"]], 1: LONG, 2: LONG, 3: LONG, 4: LONG, 5: LONG, 6: LONG },
    languages: ["English", "Malay", "Tamil"],
    services: ["Diabetes screening (blood test)", "Chronic care review", "Health coaching"],
  },
  {
    id: "c-demo-bedok",
    name: "Demo Clinic - Bedok",
    area: "Bedok",
    lat: 1.3244,
    lng: 103.9301,
    hours: { 0: [], 1: WEEKDAY, 2: WEEKDAY, 3: WEEKDAY, 4: WEEKDAY, 5: WEEKDAY, 6: [["09:00", "13:00"]] },
    languages: ["English", "Malay", "Mandarin"],
    services: ["Diabetes screening (blood test)", "Blood pressure check", "Healthier SG enrolment"],
  },
  {
    id: "c-jurong",
    active: false,
    name: "Jurong Wellness Clinic",
    area: "Jurong East",
    lat: 1.3329,
    lng: 103.7436,
    hours: { 0: [], 1: SPLIT, 2: SPLIT, 3: SPLIT, 4: SPLIT, 5: SPLIT, 6: [["08:30", "12:30"]] },
    languages: ["English", "Mandarin", "Hokkien"],
    services: ["Diabetes screening (blood test)", "Cholesterol check", "Healthier SG enrolment"],
  },
  {
    id: "c-toa-payoh",
    active: false,
    name: "Toa Payoh Care Clinic",
    area: "Toa Payoh",
    lat: 1.3343,
    lng: 103.8563,
    hours: { 0: [], 1: DAY, 2: DAY, 3: [], 4: DAY, 5: DAY, 6: DAY }, // closed Wednesdays and Sundays
    languages: ["English", "Mandarin", "Malay"],
    services: ["Diabetes screening (blood test)", "Blood pressure check", "Chronic care review"],
  },
  {
    id: "c-ang-mo-kio",
    active: false,
    name: "Ang Mo Kio Health Clinic",
    area: "Ang Mo Kio",
    lat: 1.3691,
    lng: 103.8454,
    hours: { 0: [], 1: WEEKDAY, 2: WEEKDAY, 3: WEEKDAY, 4: WEEKDAY, 5: WEEKDAY, 6: [["09:00", "17:00"]] },
    languages: ["English","Mandarin","Hokkien"],
    services: ["Diabetes screening (blood test)","Chronic care review"],
  },
  {
    id: "c-bedok",
    active: false,
    name: "Bedok Family Practice",
    area: "Bedok",
    lat: 1.3236,
    lng: 103.9273,
    hours: { 0: [["09:00", "13:00"]], 1: LONG, 2: LONG, 3: LONG, 4: LONG, 5: LONG, 6: LONG },
    languages: ["English","Malay","Mandarin"],
    services: ["Diabetes screening (blood test)","Blood pressure check","Health coaching"],
  },
  {
    id: "c-woodlands",
    active: false,
    name: "Woodlands Care Clinic",
    area: "Woodlands",
    lat: 1.4382,
    lng: 103.789,
    hours: { 0: [], 1: DAY, 2: DAY, 3: DAY, 4: DAY, 5: DAY, 6: [["09:00", "13:00"]] },
    languages: ["English","Malay","Tamil"],
    services: ["Diabetes screening (blood test)","Healthier SG enrolment"],
  },
  {
    id: "c-clementi",
    active: false,
    name: "Clementi Wellness Clinic",
    area: "Clementi",
    lat: 1.3162,
    lng: 103.7649,
    hours: { 0: [], 1: SPLIT, 2: SPLIT, 3: SPLIT, 4: SPLIT, 5: SPLIT, 6: [["08:30", "12:30"]] },
    languages: ["English","Mandarin"],
    services: ["Diabetes screening (blood test)","Cholesterol check"],
  },
  {
    id: "c-sengkang",
    active: false,
    name: "Sengkang Community Clinic",
    area: "Sengkang",
    lat: 1.3868,
    lng: 103.8914,
    hours: { 0: [["09:00", "13:00"]], 1: WEEKDAY, 2: WEEKDAY, 3: WEEKDAY, 4: WEEKDAY, 5: WEEKDAY, 6: WEEKDAY },
    languages: ["English","Mandarin","Malay"],
    services: ["Diabetes screening (blood test)","Healthier SG enrolment","Chronic care review"],
  },
  {
    id: "c-queenstown",
    active: false,
    name: "Queenstown Medical Clinic",
    area: "Queenstown",
    lat: 1.2942,
    lng: 103.806,
    hours: { 0: [], 1: DAY, 2: DAY, 3: DAY, 4: [], 5: DAY, 6: DAY },
    languages: ["English","Mandarin","Tamil"],
    services: ["Diabetes screening (blood test)","Blood pressure check"],
  },
  {
    id: "c-yishun",
    active: false,
    name: "Yishun Health Clinic",
    area: "Yishun",
    lat: 1.4304,
    lng: 103.8354,
    hours: { 0: [], 1: LONG, 2: LONG, 3: LONG, 4: LONG, 5: LONG, 6: [["08:00", "14:00"]] },
    languages: ["English","Malay","Mandarin"],
    services: ["Diabetes screening (blood test)","Chronic care review","Health coaching"],
  },
  {
    id: "c-orchard",
    active: false,
    name: "Orchard Central Clinic",
    area: "Orchard",
    lat: 1.3048,
    lng: 103.8318,
    hours: { 0: [["10:00", "18:00"]], 1: WEEKDAY, 2: WEEKDAY, 3: WEEKDAY, 4: WEEKDAY, 5: WEEKDAY, 6: [["10:00", "18:00"]] },
    languages: ["English","Mandarin","Japanese"],
    services: ["Diabetes screening (blood test)","Cholesterol check","Blood pressure check"],
  },
];

/** The clinics the demo seeds and shows: those not switched off with active: false. */
export const ACTIVE_CLINICS = CLINICS.filter((c) => c.active !== false);

/** A share stops being visible to the clinic this many days after the appointment date. */
export const SHARE_WINDOW_DAYS = 30;
