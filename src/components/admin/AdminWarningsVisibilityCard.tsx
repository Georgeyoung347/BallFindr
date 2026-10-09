/**
 * Admin moderation card: issue warnings and hide/unhide an account. Actions run through admin-moderation server functions (also available to Moderators).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getAccountWarningsAndVisibility,
  issueWarning,
  setProfileHidden,
} from "@/lib/admin-moderation.functions";
import { AdminCard } from "@/lib/admin-ui";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function AdminWarningsVisibilityCard({
  profileId,
  name,
  accountType,
}: {
  profileId: string;
  name: string;
  accountType: "player" | "club";
}) {
  const queryClient = useQueryClient();
  const fetchInfo = useServerFn(getAccountWarningsAndVisibility);
  const warn = useServerFn(issueWarning);
  const hide = useServerFn(setProfileHidden);
  const [warnOpen, setWarnOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [hideOpen, setHideOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin", "warnings-visibility", profileId],
    queryFn: () => fetchInfo({ data: { profileId } }),
  });
  const isHidden = data?.isHidden ?? false;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const warnMutation = useMutation({
    mutationFn: () => warn({ data: { profileId, message } }),
    onSuccess: () => {
      toast.success("Warning issued");
      setWarnOpen(false);
      setMessage("");
      void refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not issue the warning"),
  });

  const hideMutation = useMutation({
    mutationFn: () => hide({ data: { profileId, hidden: !isHidden } }),
    onSuccess: (res) => {
      toast.success(res.hidden ? "Profile hidden" : "Profile visible again");
      setHideOpen(false);
      void refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not change visibility"),
  });

  const typeLabel = accountType === "club" ? "Club" : "Player";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <AdminCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-sm uppercase tracking-wide">Profile Visibility</h2>
            <p className="mt-1 text-sm">{data ? (isHidden ? "Hidden" : "Visible") : "…"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Hidden profiles don't appear in discovery or search. The account is not banned and can still sign in.
            </p>
          </div>
          <Button size="sm" variant="voltOutline" disabled={!data} onClick={() => setHideOpen(true)}>
            {isHidden ? <><Eye className="size-4" /> Unhide Profile</> : <><EyeOff className="size-4" /> Hide Profile</>}
          </Button>
        </div>
      </AdminCard>

      <AdminCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-display text-sm uppercase tracking-wide">Warnings</h2>
          <Button size="sm" variant="voltOutline" onClick={() => setWarnOpen(true)}>
            <AlertTriangle className="size-4" /> Issue Warning
          </Button>
        </div>
        {data?.warnings.length ? (
          <ul className="mt-3 space-y-3">
            {data.warnings.map((w) => (
              <li key={w.id} className="rounded-xl border border-border p-3 text-sm">
                <p className="whitespace-pre-wrap break-words">{w.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {w.adminName ?? "Admin"} · {formatDateTime(w.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No warnings issued.</p>
        )}
      </AdminCard>

      <AlertDialog open={warnOpen} onOpenChange={(o) => !warnMutation.isPending && setWarnOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Issue warning?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1">
                <p><span className="font-semibold text-foreground">{name}</span> · {typeLabel}</p>
                <p>The member will receive this message as a notification. It does not ban, restrict or hide the account.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            aria-label="Warning message"
            value={message}
            maxLength={1000}
            rows={4}
            placeholder="e.g. Please do not use inappropriate language when contacting clubs."
            onChange={(e) => setMessage(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={warnMutation.isPending}>Cancel</AlertDialogCancel>
            <Button variant="volt" disabled={!message.trim() || warnMutation.isPending} onClick={() => warnMutation.mutate()}>
              {warnMutation.isPending ? "Issuing…" : "Confirm & Issue Warning"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={hideOpen} onOpenChange={(o) => !hideMutation.isPending && setHideOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isHidden ? "Unhide profile?" : "Hide profile?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isHidden
                ? "Unhide this profile and make it visible in public discovery again?"
                : "Hide this profile from public discovery? The account is not banned and can still sign in and use BallFindr."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={hideMutation.isPending}>Cancel</AlertDialogCancel>
            <Button variant="volt" disabled={hideMutation.isPending} onClick={() => hideMutation.mutate()}>
              {hideMutation.isPending ? "Saving…" : isHidden ? "Unhide Profile" : "Hide Profile"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
