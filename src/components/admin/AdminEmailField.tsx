/**
 * Admin Account Details: shows a user's current login email and lets a full admin change it via a server function (validation, duplicate check, confirmation, audit log).
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { changeAdminUserEmail, getAdminUserEmail } from "@/lib/admin-email.functions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function AdminEmailField({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const load = useServerFn(getAdminUserEmail);
  const change = useServerFn(changeAdminUserEmail);
  const { data, isPending, error } = useQuery({
    queryKey: ["admin", "user-email", profileId],
    queryFn: () => load({ data: { profileId } }),
    staleTime: 0,
  });
  const current = data?.email ?? "";
  const [value, setValue] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  useEffect(() => setValue(current), [current]);

  const next = value.trim().toLowerCase();
  const changed = next !== current.toLowerCase();
  const valid = EMAIL_RE.test(next);

  const save = useMutation({
    mutationFn: () => change({ data: { profileId, email: next } }),
    onSuccess: (res) => {
      toast.success(`Login email changed to ${res.email}`);
      setConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err) => {
      setConfirmOpen(false);
      toast.error(err instanceof Error ? err.message : "Could not change the email address");
    },
  });

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Account details</p>
      <Label htmlFor="admin-email" className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Email address
      </Label>
      {error ? (
        <p className="text-sm text-destructive">Could not load this account's email.</p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="admin-email" type="email" value={value} disabled={isPending}
            onChange={(e) => setValue(e.target.value)} placeholder={isPending ? "Loading…" : ""} />
          <Button type="button" variant="subtle" disabled={isPending || !changed || save.isPending}
            onClick={() => (valid ? setConfirmOpen(true) : toast.error("Enter a valid email address."))}>
            Change email
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Current: {current || "—"}. Saved separately from the profile fields below.</p>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !save.isPending && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change login email?</AlertDialogTitle>
            <AlertDialogDescription>
              This will change the email address this user uses to log in, from <strong>{current}</strong> to{" "}
              <strong>{next}</strong>. Their old email will no longer work for signing in. Their account and all data stay the same.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={save.isPending}>Cancel</AlertDialogCancel>
            <Button variant="volt" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Changing…" : "Confirm change"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
