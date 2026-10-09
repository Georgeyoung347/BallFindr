/**
 * Men's / Women's switcher for clubs that operate both sections.
 *
 * Only rendered for clubs whose football_section is "both". The active section
 * is stored on the club row (clubs.active_section) and enforced by RLS, so the
 * control below simply changes that stored value — it is not a UI-only filter.
 */

import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  sectionFullLabel,
  useMyClubSection,
  useSetActiveSection,
} from "@/lib/football-section";

export function SectionSwitcher() {
  const { data } = useMyClubSection();
  const setActive = useSetActiveSection();

  if (!data || data.section !== "both") return null;

  const other = data.activeSection === "mens" ? "womens" : "mens";

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-elevated/60 px-3 py-2">
      <p className="text-sm">
        <span className="text-muted-foreground">Viewing: </span>
        <span className="font-semibold">{sectionFullLabel(data.activeSection)}</span>
      </p>
      <Button
        variant="subtle"
        size="sm"
        disabled={setActive.isPending}
        onClick={() => {
          setActive.mutate(other, {
            onSuccess: () => toast.success(`Now viewing ${sectionFullLabel(other)}`),
            onError: (error) =>
              toast.error(
                error instanceof Error ? error.message : "Could not switch section.",
              ),
          });
        }}
      >
        <ArrowLeftRight className="size-4" />
        Switch to {other === "mens" ? "Men's" : "Women's"}
      </Button>
    </div>
  );
}
