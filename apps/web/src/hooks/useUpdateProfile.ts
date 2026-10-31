"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SOCIAL_SESSION_QUERY_KEY } from "./useSocialSession";
import type { SocialProfile } from "@/lib/social/types";

export interface UpdateProfileInput {
  username?: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput): Promise<SocialProfile> => {
      const res = await fetch("/api/social/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update profile (${res.status})`);
      }

      const data = (await res.json()) as { profile: SocialProfile };
      return data.profile;
    },
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(SOCIAL_SESSION_QUERY_KEY, updatedProfile);
      void queryClient.invalidateQueries({ queryKey: SOCIAL_SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["social-feed"] });
    },
  });
}
