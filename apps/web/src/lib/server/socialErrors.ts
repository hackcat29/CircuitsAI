import { NextResponse } from "next/server";

// Shared error type for every /api/social/* route: thrown deep inside a helper
// (requireActor, rate limiting, ownership checks) and turned into a JSON response at the
// route handler boundary via errorResponse(), so individual routes don't each re-implement
// status-code mapping.
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  const message = error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
