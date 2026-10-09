/**
 * Banner shown inside Player/Club areas when the signed-in account is restricted/banned (data from lib/moderation).
 */
import { ShieldAlert } from "lucide-react";
import { formatRestrictionExpiry, useMyRestriction } from "@/lib/moderation";

/**
 * Shown to a member whose account is currently restricted.
 * Only ever reads public.my_restriction(), which returns the caller's own
 * restriction. No admin notes or moderation evidence are exposed.
 */
export function RestrictedNotice() {
  const { data } = useMyRestriction();
  if (!data) return null;

  const expiry = formatRestrictionExpiry(data.expiresAt);
  return (
    <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="min-w-0">
          <p className="font-display text-sm uppercase text-destructive">
            {data.kind === "permanent"
              ? "Your account has been permanently restricted"
              : "Your account is temporarily restricted"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            While your account is restricted you can't send messages, and your profile won't appear
            to other members.{" "}
            {data.kind === "permanent"
              ? "This restriction stays in place until it is removed by the BallFindr team."
              : expiry
                ? `The restriction is due to lift on ${expiry}.`
                : "The restriction will lift automatically."}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            If you think this is a mistake, contact us at ballfindr@gmail.com.
          </p>
        </div>
      </div>
    </div>
  );
}
