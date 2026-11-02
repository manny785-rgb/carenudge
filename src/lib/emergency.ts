// Hospitals with a 24-hour emergency department (A&E) in Singapore.
// Addresses, hours and phone numbers were checked against each hospital's own website.
// Coordinates are approximate (used only to sort by distance). Re-check this list before a public demo.
import type { Point } from "./geo";

export interface EmergencyDept extends Point {
  id: string;
  name: string;
  address: string;
  phone: string | null; // hospital line, not a substitute for 995
  note?: string;
}

export const EMERGENCY_DEPTS: EmergencyDept[] = [
  { id: "sgh", name: "Singapore General Hospital Emergency Department", address: "Outram Road, Singapore 169608 (Block 1)", phone: "6222 3322", lat: 1.2796, lng: 103.8349 },
  { id: "ttsh", name: "Tan Tock Seng Hospital Emergency Department", address: "11 Jalan Tan Tock Seng, Singapore 308433 (Emergency Block, Level B1)", phone: "6357 8754", lat: 1.3213, lng: 103.8458 },
  { id: "nuh", name: "National University Hospital Emergency Department", address: "5 Lower Kent Ridge Road, Singapore 119074 (Main Building, Zone F, Level 1)", phone: "6908 2222", lat: 1.294, lng: 103.7833 },
  { id: "ntfgh", name: "Ng Teng Fong General Hospital Emergency Department", address: "1 Jurong East Street 21, Singapore 609606 (Tower B, Level 1)", phone: "6908 2222", lat: 1.3338, lng: 103.7451 },
  { id: "cgh", name: "Changi General Hospital Emergency Department", address: "2 Simei Street 3, Singapore 529889", phone: "6788 8833", lat: 1.3406, lng: 103.9496 },
  { id: "skh", name: "Sengkang General Hospital Emergency Department", address: "110 Sengkang East Way, Singapore 544886", phone: "6930 5000", lat: 1.3951, lng: 103.8934 },
  { id: "ktph", name: "Khoo Teck Puat Hospital A&E", address: "90 Yishun Central, Singapore 768828 (Tower A, Level 1)", phone: "6555 8000", lat: 1.4247, lng: 103.8385 },
  { id: "kkh", name: "KK Women's and Children's Hospital Children's Emergency", address: "100 Bukit Timah Road, Singapore 229899 (Basement 1, Children's Tower)", phone: null, lat: 1.3106, lng: 103.8459, note: "For children" },
];
