/**
 * 'Do you currently have a club?' choice used in signup, Edit Profile and Admin; 'No' means Free Agent.
 */
import { cn } from "@/lib/utils";

export const FREE_AGENT = "Free Agent";

export function isFreeAgent(name: string | null | undefined): boolean {
  return (name ?? "").replace(/[^a-z]/gi, "").toLowerCase() === "freeagent";
}

/** "Do you currently have a club?" Yes/No shown above Current club / level. */
export function ClubStatusChoice({
  value,
  onChange,
  required = false,
  error = false,
}: {
  value: boolean | null;
  onChange: (hasClub: boolean) => void;
  required?: boolean;
  error?: boolean;
}) {
  return (
    <fieldset className="space-y-1.5 sm:col-span-2">
      <legend className={cn("text-sm font-medium", error && "text-destructive")}>
        Do you currently have a club?{required ? " *" : ""}
      </legend>
      <div className="flex gap-4 pt-1">
        {[
          { label: "Yes", v: true },
          { label: "No", v: false },
        ].map((o) => (
          <label key={o.label} className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              className="size-4 accent-primary"
              checked={value === o.v}
              onChange={() => onChange(o.v)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
