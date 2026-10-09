/**
 * Member-side reporting and account restriction state.
 *
 * Security notes:
 * - Reports are inserted through RLS ("reporter_profile_id = auth.uid()" and
 *   "reported_profile_id <> auth.uid()"). A BEFORE trigger re-derives the
 *   reporter, the reported sender, the conversation and a snapshot of the
 *   reported message straight from the database, so the browser cannot forge
 *   evidence or the status.
 * - Members cannot read reports or admin notes back; nothing here selects them.
 * - Restriction state is read through public.my_restriction(), which only ever
 *   returns the signed-in caller's own active restriction.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const REPORT_REASONS = [
  "Harassment or bullying",
  "Inappropriate or offensive content",
  "Spam",
  "Fake or misleading profile",
  "Unwanted contact",
  "Other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ReportInput {
  /** The account being reported. For a message report this must be the sender. */
  reportedProfileId: string;
  reason: string;
  details?: string;
  /** Present when reporting one specific message. */
  messageId?: string;
}

export function useSubmitReport() {
  return useMutation({
    mutationFn: async (input: ReportInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;
      if (!me) throw new Error("Please sign in again to send a report.");
      if (me === input.reportedProfileId) throw new Error("You cannot report your own account.");

      const { error } = await supabase.from("reports").insert({
        reporter_profile_id: me,
        reported_profile_id: input.reportedProfileId,
        reason: input.reason,
        details: input.details?.trim() ? input.details.trim() : null,
        kind: input.messageId ? "message" : "profile",
        message_id: input.messageId ?? null,
      });
      if (error) throw new Error(error.message);
      return { ok: true as const };
    },
  });
}

export interface MyRestriction {
  kind: "temporary" | "permanent";
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** The signed-in member's own active restriction, or null. */
export function useMyRestriction() {
  return useQuery({
    queryKey: ["my-restriction"],
    staleTime: 30_000,
    queryFn: async (): Promise<MyRestriction | null> => {
      const { data, error } = await supabase.rpc("my_restriction");
      if (error) return null;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return {
        kind: (row as any).kind === "permanent" ? "permanent" : "temporary",
        reason: (row as any).reason ?? null,
        expiresAt: (row as any).expires_at ?? null,
        createdAt: (row as any).created_at,
      };
    },
  });
}

export function formatRestrictionExpiry(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The signed-in member's own profile id (used to hide self-report controls). */
export function useMyProfileId() {
  return useQuery({
    queryKey: ["my-profile-id"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
  });
}
