import { NextResponse } from "next/server";
import { computeContributorLeaderboard } from "@/lib/server/contributorScore";

export async function GET() {
  const entries = await computeContributorLeaderboard();
  return NextResponse.json({ entries, generatedAt: new Date().toISOString() });
}
