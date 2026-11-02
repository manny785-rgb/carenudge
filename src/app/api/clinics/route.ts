import { connection } from "next/server";
import { readDb } from "@/lib/db";

// The clinic list comes from the database so edited profiles (hours, services…) show up everywhere.
export async function GET() {
  await connection(); // read at request time, never frozen into the build
  return Response.json({ clinics: (await readDb()).clinics });
}
