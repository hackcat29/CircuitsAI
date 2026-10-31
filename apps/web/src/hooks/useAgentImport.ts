"use client";

import { useState } from "react";
import { parseAgentManifest, type ParsedAgentManifest } from "@/lib/agentImport";

export function useAgentImport() {
  const [busy, setBusy] = useState(false);

  async function importFromJson(raw: string): Promise<ParsedAgentManifest> {
    setBusy(true);
    try {
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error("That's not valid JSON.");
      }
      return parseAgentManifest(json);
    } finally {
      setBusy(false);
    }
  }

  async function importFromUrl(url: string): Promise<ParsedAgentManifest> {
    setBusy(true);
    try {
      const res = await fetch("/api/agents/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Import failed (${res.status}).`);
      return body as ParsedAgentManifest;
    } finally {
      setBusy(false);
    }
  }

  return { importFromJson, importFromUrl, busy };
}
