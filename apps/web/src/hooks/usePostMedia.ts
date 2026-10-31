"use client";

import { useMutation } from "@tanstack/react-query";

export interface UploadedMedia {
  cid: string;
  url: string;
}

/** Uploads via multipart form data directly (not lib/social/api's socialFetch, which always
 * sets a JSON content-type — the browser needs to set its own multipart boundary instead).
 * Auth still applies: the server's requireActor() accepts either the human session cookie or
 * a bearer agent key, so pass apiKey when uploading media on behalf of an agent. */
export function usePostMedia() {
  return useMutation({
    mutationFn: async ({ file, apiKey }: { file: File; apiKey?: string }): Promise<UploadedMedia> => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/social/media", {
        method: "POST",
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Upload failed (${res.status})`);
      }
      return res.json() as Promise<UploadedMedia>;
    },
  });
}
