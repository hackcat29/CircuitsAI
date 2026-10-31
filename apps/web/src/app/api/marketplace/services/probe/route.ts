import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/server/socialErrors";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const raw = (typeof body?.endpoint === "string" ? body.endpoint : typeof body?.endpointUrl === "string" ? body.endpointUrl : "")?.trim();
    const endpoint = raw || "";

    if (!endpoint) {
      throw new ApiError(400, "Missing endpoint URL.");
    }

    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new ApiError(400, "Invalid endpoint URL format.");
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new ApiError(400, "Endpoint must use HTTP or HTTPS protocol.");
    }

    const start = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const isMcpTarget = url.pathname.includes("/mcp") || endpoint.startsWith("mcp://");

    try {
      let res: Response;
      if (isMcpTarget) {
        res = await fetch(url.toString(), {
          method: "POST",
          signal: controller.signal,
          headers: {
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
            "User-Agent": "Circuits-HealthProbe/1.0",
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
        });
      } else {
        try {
          res = await fetch(url.toString(), {
            method: "GET",
            signal: controller.signal,
            headers: {
              Accept: "application/json, text/event-stream, */*",
              "User-Agent": "Circuits-HealthProbe/1.0",
            },
          });
          if (res.status === 405) {
            res = await fetch(url.toString(), {
              method: "POST",
              signal: controller.signal,
              headers: {
                Accept: "application/json, text/event-stream",
                "Content-Type": "application/json",
                "User-Agent": "Circuits-HealthProbe/1.0",
              },
              body: JSON.stringify({ ping: true }),
            });
          }
        } catch (getErr: any) {
          if (getErr.name !== "AbortError") {
            // Retry with POST once
            res = await fetch(url.toString(), {
              method: "POST",
              signal: controller.signal,
              headers: {
                Accept: "application/json, text/event-stream",
                "Content-Type": "application/json",
                "User-Agent": "Circuits-HealthProbe/1.0",
              },
              body: JSON.stringify({ ping: true }),
            });
          } else {
            throw getErr;
          }
        }
      }

      const latencyMs = Math.max(1, Math.round(performance.now() - start));
      const contentType = res.headers.get("content-type") || "";
      const isMcp = isMcpTarget || contentType.includes("text/event-stream");

      // Check if server actively responded with a reachable HTTP status
      const isHealthy = res.status < 500 && res.status !== 404;

      if (!isHealthy) {
        return NextResponse.json({
          ok: false,
          status: res.status,
          latencyMs,
          isMcp,
          error:
            res.status === 404
              ? "Endpoint returned 404 Not Found. Verify the URL path."
              : `Endpoint returned HTTP ${res.status} (${res.statusText || "Server Error"}).`,
        });
      }

      return NextResponse.json({
        ok: true,
        status: res.status,
        latencyMs,
        isMcp,
        contentType,
        message: `Endpoint verified (HTTP ${res.status}) in ${latencyMs}ms.`,
      });
    } catch (err: any) {
      const latencyMs = Math.max(1, Math.round(performance.now() - start));
      const errorMsg =
        err.name === "AbortError"
          ? "Endpoint timed out after 6000ms. Check if the server is responsive."
          : `Connection failed: ${err.message || "Host unreachable"}`;

      return NextResponse.json({
        ok: false,
        status: 0,
        latencyMs,
        isMcp: false,
        error: errorMsg,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
