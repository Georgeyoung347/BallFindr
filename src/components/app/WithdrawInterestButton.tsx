/**
 * Lets a player withdraw an application (status -> withdrawn); DB trigger enforces allowed status transitions.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWithdrawApplication } from "@/lib/applications";

/** Shared "Withdraw Interest" action used on the Applications tab and the vacancy view. */
export function WithdrawInterestButton({
  applicationId,
  onWithdrawn,
}: {
  applicationId: string;
  onWithdrawn?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const withdraw = useWithdrawApplication();

  const confirm = () =>
    withdraw.mutate(
      { id: applicationId },
      {
        onSuccess: () => {
          setOpen(false);
          onWithdrawn?.();
          toast.success("Interest withdrawn");
        },
        onError: (e) =>
          toast.error("Couldn't withdraw your interest", {
            description: e instanceof Error ? e.message : undefined,
          }),
      },
    );

  return (
    <>
      <Button variant="quiet" size="sm" onClick={() => setOpen(true)}>
        <Undo2 className="size-4" /> Withdraw Interest
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !withdraw.isPending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw your interest from this vacancy?</AlertDialogTitle>
            <AlertDialogDescription>
              The club will no longer see you as interested. You can register interest again
              later if the vacancy is still open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={withdraw.isPending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={withdraw.isPending} onClick={confirm}>
              {withdraw.isPending ? "Withdrawing…" : "Withdraw Interest"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
