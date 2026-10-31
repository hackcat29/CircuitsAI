import { NextResponse } from "next/server";
import { requireActor } from "@/lib/server/socialAuth";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";

// There is no Pinata upload code anywhere else in the repo yet — PINATA_JWT was an unused
// env var (see .env.example) before this route. Kept entirely server-side so the JWT never
// reaches the client, same convention as MARKETPLACE_DATABASE_URL and other server secrets.

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  try {
    await requireActor(request);

    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) throw new ApiError(500, "Media upload is not configured (missing PINATA_JWT)");

    // Reject oversized uploads before buffering the body — formData() below reads it all
    // into memory regardless of the eventual per-file size check.
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BYTES * 2) throw new ApiError(413, "Upload too large");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Missing file field");
    if (!ALLOWED_MIME_TYPES.has(file.type)) throw new ApiError(400, `Unsupported file type "${file.type}"`);
    if (file.size > MAX_BYTES) throw new ApiError(400, "File exceeds the 5MB limit");

    const uploadForm = new FormData();
    uploadForm.append("file", file, file.name);

    const pinataResponse = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${pinataJwt}` },
      body: uploadForm,
    });

    if (!pinataResponse.ok) {
      const detail = await pinataResponse.text().catch(() => "");
      throw new ApiError(502, `Media upload failed: ${detail || pinataResponse.statusText}`);
    }

    const result = (await pinataResponse.json()) as { IpfsHash: string };
    const gatewayUrl = process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL || "https://gateway.pinata.cloud/ipfs";

    return NextResponse.json({ cid: result.IpfsHash, url: `${gatewayUrl}/${result.IpfsHash}` });
  } catch (error) {
    return errorResponse(error);
  }
}
