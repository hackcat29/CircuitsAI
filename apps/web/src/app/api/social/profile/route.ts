import { NextResponse } from "next/server";
import { prisma } from "@clawdhq/social-db";
import { requireActor } from "@/lib/server/socialAuth";
import { serializeProfile } from "@/lib/server/socialValidate";
import { errorResponse, ApiError } from "@/lib/server/socialErrors";
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

export async function PATCH(request: Request) {
  try {
    assertApiRateLimit(request, "social-profile-update", 20, 60_000);
    const { profile: actor } = await requireActor(request);

    if (actor.kind !== "HUMAN") {
      throw new ApiError(403, "Only human profiles can update personal profile info via this endpoint");
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new ApiError(400, "Request body must be a JSON object");
    }

    const updateData: {
      username?: string;
      displayName?: string | null;
      bio?: string | null;
      avatarUrl?: string | null;
    } = {};

    // 1. Username Validation
    if (typeof body.username === "string") {
      const cleanUsername = body.username.trim().toLowerCase();
      if (!USERNAME_REGEX.test(cleanUsername)) {
        throw new ApiError(400, "Username must be 3-20 characters long and contain only lowercase letters, numbers, and underscores");
      }
      if (RESERVED_USERNAMES.has(cleanUsername)) {
        throw new ApiError(400, `The username "@${cleanUsername}" is reserved by the platform`);
      }
      // Check collision if changed
      if (cleanUsername !== actor.username) {
        const existing = await prisma.profile.findUnique({ where: { username: cleanUsername } });
        if (existing && existing.id !== actor.id) {
          throw new ApiError(409, `The username "@${cleanUsername}" is already taken`);
        }
        updateData.username = cleanUsername;
      }
    }

    // 2. Display Name
    if (body.displayName !== undefined) {
      if (typeof body.displayName === "string") {
        const trimmed = body.displayName.trim();
        updateData.displayName = trimmed.length > 0 ? trimmed.slice(0, 50) : null;
      } else if (body.displayName === null) {
        updateData.displayName = null;
      }
    }

    // 3. Bio
    if (body.bio !== undefined) {
      if (typeof body.bio === "string") {
        const trimmed = body.bio.trim();
        updateData.bio = trimmed.length > 0 ? trimmed.slice(0, 280) : null;
      } else if (body.bio === null) {
        updateData.bio = null;
      }
    }

    // 4. Avatar URL
    if (body.avatarUrl !== undefined) {
      if (typeof body.avatarUrl === "string") {
        const trimmed = body.avatarUrl.trim();
        if (trimmed.length > 0) {
          if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("ipfs://") && !trimmed.startsWith("data:")) {
            throw new ApiError(400, "avatarUrl must be a valid http, https, ipfs, or data URI");
          }
          updateData.avatarUrl = trimmed.slice(0, 500);
        } else {
          updateData.avatarUrl = null;
        }
      } else if (body.avatarUrl === null) {
        updateData.avatarUrl = null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ profile: serializeProfile(actor) });
    }

    const updated = await prisma.profile.update({
      where: { id: actor.id },
      data: updateData,
    });

    return NextResponse.json({ profile: serializeProfile(updated) });
  } catch (error) {
    return errorResponse(error);
  }
}
