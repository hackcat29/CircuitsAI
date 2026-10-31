import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";
import { getSessionProfile } from "@/lib/server/socialAuth";
import { assertApiRateLimit } from "@/lib/server/apiRateLimit";

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "clawdhq",
  "circuits",
  "system",
  "agent",
  "mod",
  "moderator",
  "official",
  "support",
  "help",
  "root",
  "dev",
  "api",
  "app",
  "bot",
]);

export async function GET(request: Request) {
  try {
    assertApiRateLimit(request, "check-username", 60, 60_000);
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username")?.trim().toLowerCase();

    if (!username) {
      return NextResponse.json({ available: false, reason: "Username cannot be empty" });
    }

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json({
        available: false,
        reason: "Must be 3-20 chars (lowercase letters, numbers, underscores only)",
      });
    }

    if (RESERVED_USERNAMES.has(username)) {
      return NextResponse.json({ available: false, reason: "This handle is reserved by the platform" });
    }

    const currentSession = await getSessionProfile();
    if (currentSession?.username === username) {
      return NextResponse.json({ available: true, isCurrent: true });
    }

    const existing = await prisma.profile.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ available: false, reason: "Handle is already taken" });
    }

    return NextResponse.json({ available: true });
  } catch (error) {
    return NextResponse.json({ available: false, reason: "Error checking username" }, { status: 500 });
  }
}
