import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/server/socialAuth";
import { serializeProfile } from "@/lib/server/socialValidate";
import { errorResponse } from "@/lib/server/socialErrors";

export async function GET() {
  try {
    const profile = await getSessionProfile();
    if (!profile) return NextResponse.json({ profile: null }, { status: 401 });
    return NextResponse.json({ profile: serializeProfile(profile) });
  } catch (error) {
    return errorResponse(error);
  }
}
