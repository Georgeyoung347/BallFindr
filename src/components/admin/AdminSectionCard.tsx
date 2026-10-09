/**
 * Admin card for changing an account's football section (Men's / Women's / Both for clubs). Writes via admin server functions and logs the change.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil } from "lucide-react";
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
import { setFootballSection } from "@/lib/admin-data.functions";
import { AdminCard, adminField } from "@/lib/admin-ui";
import { sectionFullLabel, type ClubSection } from "@/lib/football-section";

export function AdminSectionCard({
  profileId,
  accountType,
  section,
}: {
  profileId: string;
  accountType: "player" | "club";
  section: ClubSection | null;
}) {
  const queryClient = useQueryClient();
  const save = useServerFn(setFootballSection);
  const isClub = accountType === "club";
  const current: ClubSection = section ?? "mens";
  const [editing, setEditing] = useState(false);
  const [next, setNext] = useState<ClubSection>(current);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const options: ClubSection[] = isClub ? ["mens", "womens", "both"] : ["mens", "womens"];

  const mutation = useMutation({
    mutationFn: () => save({ data: { profileId, section: next } }),
    onSuccess: () => {
      toast.success(isClub ? "Football sections updated" : "Football section updated");
      setConfirmOpen(false);
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not change the section"),
  });

  return (
    <AdminCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-sm uppercase tracking-wide">
            {isClub ? "Football Sections" : "Football Section"}
          </h2>
          <p className="mt-1 text-sm">{sectionFullLabel(current)}</p>
        </div>
        {!editing ? (
          <Button size="sm" variant="voltOutline" onClick={() => { setNext(current); setEditing(true); }}>
            <Pencil className="size-4" /> Edit Section
          </Button>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            aria-label="New football section"
            className={`${adminField} max-w-xs`}
            value={next}
            onChange={(e) => setNext(e.target.value as ClubSection)}
          >
            {options.map((o) => (
              <option key={o} value={o}>{sectionFullLabel(o)}</option>
            ))}
          </select>
          <Button size="sm" variant="volt" disabled={next === current} onClick={() => setConfirmOpen(true)}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !mutation.isPending && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change football section?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="font-semibold text-foreground">
                  {sectionFullLabel(current)} → {sectionFullLabel(next)}
                </p>
                <p>
                  BallFindr separates Men's and Women's recruitment, so this may change which players, clubs,
                  vacancies and recruitment opportunities this account can see and interact with.
                </p>
                {isClub && next === "both" ? (
                  <p>A club set to Both can operate in Men's and Women's using its existing section switcher.</p>
                ) : null}
                {isClub && current === "both" && next !== "both" ? (
                  <p>The club's active section will be set to {sectionFullLabel(next)}.</p>
                ) : null}
                <p>No other profile information, badges, roles or messages are changed.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
            <Button variant="volt" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Saving…" : "Confirm & Save"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminCard>
  );
}
