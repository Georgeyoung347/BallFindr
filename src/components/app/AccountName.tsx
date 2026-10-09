/**
 * Renders an account name with its Verified badge, Owner (BallFindr logo) mark and Founder Club badge wherever names appear.
 */
import type { ReactNode } from "react";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import ownerMark from "@/assets/ballfindr-owner-mark.png";

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export function FounderClubMark({ className }: { className?: string }) {
  return (
    <ShieldCheck
      className={cn("size-[1em] shrink-0 text-primary", className)}
      aria-label="Founder Club"
      role="img"
    />
  );
}

export function VerifiedMark({ className }: { className?: string }) {
  return (
    <BadgeCheck
      className={cn("size-[1em] shrink-0 fill-[color:var(--success)] text-[color:var(--success-foreground)]", className)}
      aria-label="Verified account"
      role="img"
    />
  );
}

export function OwnerMark({ className }: { className?: string }) {
  return <img src={ownerMark} alt="BallFindr Owner" title="BallFindr Owner" className={cn("inline-block size-[1em] shrink-0 object-contain", className)} />;
}

export function AccountName({
  children,
  verified = false,
  founder = false,
  owner = false,
  className,
  truncate = true,
}: {
  children: ReactNode;
  verified?: boolean | undefined;
  founder?: boolean | undefined;
  owner?: boolean | undefined;
  className?: string;
  /** When false, long names wrap onto multiple lines instead of truncating. */
  truncate?: boolean;
}) {
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1", className)}>
      <span className={truncate ? "truncate" : "min-w-0 break-words"}>{children}</span>
      {founder ? <FounderClubMark /> : null}
      {verified ? <VerifiedMark /> : null}
      {owner ? <OwnerMark /> : null}
    </span>
  );
}