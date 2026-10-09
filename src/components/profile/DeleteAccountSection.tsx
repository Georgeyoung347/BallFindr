/**
 * "Delete account" danger zone shared by the player and club profile pages.
 * Requires the user to type DELETE before the server function runs.
 */

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/app/ui";
import { supabase } from "@/integrations/supabase/client";
import { DELETE_CONFIRMATION_WORD, deleteMyAccount } from "@/lib/account.functions";

export function DeleteAccountSection({ accountType }: { accountType: "player" | "club" }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const deleteAccount = useServerFn(deleteMyAccount);

  const noun = accountType === "club" ? "club" : "player";
  const confirmed = typed.trim() === DELETE_CONFIRMATION_WORD;

  function reset(nextOpen: boolean) {
    if (busy) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setTyped("");
      setError(null);
    }
  }

  async function onConfirm() {
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount({ data: { confirmation: typed.trim() } });
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Your account could not be deleted. Please try again.");
      return;
    }
    // Deletion succeeded server-side: clear the local session and cached data.
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    queryClient.clear();
    toast.success("Your BallFindr account has been permanently deleted.");
    void navigate({ to: "/", replace: true });
  }

  return (
    <>
      <Panel className="border-destructive/30">
        <p className="eyebrow text-destructive">Account</p>
        <h3 className="mt-2 text-sm font-semibold">Delete account</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Permanently delete your BallFindr {noun} account and its associated data. This cannot be
          undone.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setOpen(true)}
        >
          Delete account
        </Button>
      </Panel>

      <Dialog open={open} onOpenChange={reset}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto overscroll-contain sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="size-4 text-destructive" /> Delete your account?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete your BallFindr {noun} account and its associated account
              data — your profile, uploaded images
              {accountType === "player"
                ? ", media, history, achievements, saved items, applications and trial invitations"
                : ", history, achievements, vacancies, applications, trial invitations and saved players"}
              , plus your conversations. You will be signed out and will not be able to sign back in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-account-confirm">
              Type <span className="font-mono font-semibold">{DELETE_CONFIRMATION_WORD}</span> to
              confirm
            </Label>
            <Input
              id="delete-account-confirm"
              autoComplete="off"
              autoCapitalize="characters"
              value={typed}
              disabled={busy}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={DELETE_CONFIRMATION_WORD}
            />
            {error ? (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => reset(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!confirmed || busy}
              onClick={() => void onConfirm()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {busy ? "Deleting…" : "Permanently delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
