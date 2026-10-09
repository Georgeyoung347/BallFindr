/**
 * Dialog for marking which player was signed when closing a vacancy.
 */
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrialStatusBadge } from "@/components/app/TrialInviteBits";
import { TrialOutcomeControls } from "@/components/club/TrialOutcomeControls";
import { formatTrialDate } from "@/lib/trial-invites";
import { matchesName, type ClubTrialEntry } from "@/lib/trial-outcomes";

/** Choose which trial invitee(s) for THIS vacancy were signed. */
export function VacancySignDialog({ vacancyTitle, entries }: { vacancyTitle: string; entries: ClubTrialEntry[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = useMemo(() => entries.filter((e) => matchesName(e.playerName, q)), [entries, q]);
  const signed = entries.filter((e) => e.outcome === "signed").length;

  return (
    <>
      <Button variant="subtle" size="sm" onClick={() => setOpen(true)}>
        Signed{signed ? ` (${signed})` : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Signed — {vacancyTitle}</DialogTitle>
            <DialogDescription>Players invited to trial for this vacancy. Choose who you signed.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by player name" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="space-y-2">
            {list.length ? (
              list.map((e) => (
                <div key={e.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{e.playerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {[e.playerPosition, `Trial ${formatTrialDate(e.trialDate, { short: true })}`].filter(Boolean).join(" • ")}
                      </p>
                    </div>
                    <TrialStatusBadge invite={e} />
                  </div>
                  <div className="mt-2">
                    <TrialOutcomeControls entry={e} signedOnly />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {entries.length ? "No players match that name." : "No players have been invited to trial for this vacancy yet."}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
