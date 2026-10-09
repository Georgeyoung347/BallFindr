/**
 * Settings: light/dark theme toggle (lib/theme, stored in localStorage).
 */
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/app/ui";
import { cn } from "@/lib/utils";
import { useTheme, type BallFindrTheme } from "@/lib/theme";

const options: Array<{
  value: BallFindrTheme;
  label: string;
  icon: typeof Moon;
}> = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
];

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <Panel>
      <p className="eyebrow">Appearance</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Choose how BallFindr looks on this device.
      </p>
      <div
        className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-border bg-elevated/60 p-1"
        role="group"
        aria-label="Theme"
      >
        {options.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            type="button"
            variant="quiet"
            size="sm"
            aria-pressed={theme === value}
            onClick={() => setTheme(value)}
            className={cn(
              "w-full rounded-md",
              theme === value
                ? "bg-background text-primary shadow-sm hover:text-primary"
                : "text-muted-foreground hover:bg-background/60",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
      </div>
    </Panel>
  );
}