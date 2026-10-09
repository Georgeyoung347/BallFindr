/**
 * Club controls to record a trial outcome (Signed / Not Signed) via the record_trial_outcome DB function.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  outcomeLabels,
  outcomeTone,
  useRecordTrialOutcome,
  type ClubTrialEntry,
  type OutcomeDisplay,
  type TrialOutcome,
} from "@/lib/trial-outcomes";

export function OutcomeBadge({ outcome }: { outcome: OutcomeDisplay }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", outcomeTone[outcome])}>
      {outcomeLabels[outcome]}
    </span>
  );
}

/** Signed / Not Signed buttons with confirmation. Shows the outcome once recorded. */
export function TrialOutcomeControls({ entry, signedOnly = false }: { entry: ClubTrialEntry; signedOnly?: boolean }) {
  const record = useRecordTrialOutcome();
  const [pending, setPending] = useState<TrialOutcome | null>(null);

  if (entry.outcome !== "pending" && entry.outcome !== "passed") return <OutcomeBadge outcome={entry.outcome} />;
  if (entry.status === "cancelled") return <span className="text-xs text-muted-foreground">Invite cancelled</span>;

  const confirm = () => {
    if (!pending) return;
    record.mutate(
      { inviteId: entry.id, outcome: pending },
      {
        onSuccess: () => {
          toast.success(pending === "signed" ? `${entry.playerName} recorded as Signed` : "Recorded as Not Signed");
          setPending(null);
        },
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Could not record the outcome");
          setPending(null);
        },
      },
    );
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="volt" disabled={record.isPending} onClick={() => setPending("signed")}>
          Signed
        </Button>
        {signedOnly ? null : (
          <Button size="sm" variant="subtle" disabled={record.isPending} onClick={() => setPending("not_signed")}>
            Not Signed
          </Button>
        )}
      </div>
      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && !record.isPending && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending === "signed" ? `Record ${entry.playerName} as Signed?` : `Record ${entry.playerName} as Not Signed?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending === "signed"
                ? `This records that your club signed ${entry.playerName}${entry.vacancyTitle ? ` for "${entry.vacancyTitle}"` : ""}. The trial history stays in place. This can't be undone.`
                : "The trial stays in your history with this outcome. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={record.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={record.isPending}
              onClick={(e) => {
                e.preventDefault();
                confirm();
              }}
            >
              {record.isPending ? "Saving…" : pending === "signed" ? "Confirm Signed" : "Confirm Not Signed"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
