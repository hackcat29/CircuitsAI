import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";
import { fetchPublicJson } from "@/lib/server/fetchPublicJson";
import { parseAgentManifest } from "@/lib/agentImport";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) throw new ApiError(400, "Missing url.");

    const manifest = await fetchPublicJson(url);

    try {
      return NextResponse.json(parseAgentManifest(manifest));
    } catch (err) {
      throw new ApiError(422, err instanceof Error ? err.message : "Couldn't parse that agent manifest.");
    }
  } catch (error) {
    return errorResponse(error);
  }
}
