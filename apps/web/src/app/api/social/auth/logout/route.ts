import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/server/socialAuth";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
