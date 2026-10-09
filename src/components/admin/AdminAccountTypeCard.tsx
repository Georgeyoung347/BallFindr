/**
 * Admin Edit Profile card: lets a full admin switch an account between Player and Club in place (server function does the switch, clears old-type fields, logs to Action History).
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Repeat } from "lucide-react";
import { toast } from "sonner";
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
import { supabase } from "@/integrations/supabase/client";
import { AdminCard } from "@/lib/admin-ui";

type AccountType = "player" | "club";
const label = (t: AccountType) => (t === "club" ? "Club" : "Player");

/** Admin-only. The database function re-checks the admin role and records the change. */
export function AdminAccountTypeCard({ profileId, accountType }: { profileId: string; accountType: AccountType }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const target: AccountType = accountType === "club" ? "player" : "club";

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_switch_account_type" as never, {
        _profile_id: profileId,
        _to: target,
      } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setOpen(false);
      setAgreed(false);
      toast.success(`Account switched to ${label(target)}`);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not switch account type"),
  });

  return (
    <AdminCard>
      <h2 className="font-display text-sm uppercase tracking-wide">Account Type</h2>
      <p className="mt-2 text-sm">
        Current: <span className="font-semibold">{label(accountType)}</span>
      </p>
      <Button size="sm" variant="voltOutline" className="mt-3" onClick={() => setOpen(true)}>
        <Repeat className="size-4" /> Switch to {label(target)}
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setAgreed(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to {label(target)}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  You are about to change this account from {label(accountType)} to {label(target)}.
                </p>
                <p>
                  The account&apos;s login, email, password, name, messages and account-level history will
                  remain.
                </p>
                <p>
                  The existing {label(accountType)} profile information will be cleared and the account
                  will become a blank {label(target)} profile. The user will need to complete their{" "}
                  {label(target)} profile when they next log in.
                </p>
                <p className="font-semibold">This action cannot be automatically undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            I understand and want to switch this account to {label(target)}
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={!agreed || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Switching…" : `Switch to ${label(target)}`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminCard>
  );
}
