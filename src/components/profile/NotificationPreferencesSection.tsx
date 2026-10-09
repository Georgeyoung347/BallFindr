/**
 * Notification settings: a "Push notifications" master switch (stored as
 * notification_preferences.push_enabled, for the future native push sender)
 * above four category switches enforced in the database when notifications
 * are created. The master turns all four on/off together and shows ON when
 * at least one is on. No saved row
 * means everything is on.
 */
import { PhoneNotificationStatus } from "@/components/profile/PhoneNotificationStatus";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Panel } from "@/components/app/ui";
import { supabase } from "@/integrations/supabase/client";

type PrefKey = "messages" | "applications" | "trials" | "recruitment";
type Prefs = Record<PrefKey, boolean> & { push_enabled: boolean };

const DEFAULTS: Prefs = { push_enabled: true, messages: true, applications: true, trials: true, recruitment: true };

const ROWS: { key: PrefKey; label: string; body: string }[] = [
  { key: "messages", label: "Messages", body: "New messages in your conversations." },
  { key: "applications", label: "Interests & applications", body: "New interest, application updates and withdrawals." },
  { key: "trials", label: "Trials", body: "Trial invitations, responses, cancellations and outcomes." },
  { key: "recruitment", label: "Recruitment activity", body: "Saved club vacancy alerts, saved player availability and media reactions." },
];

const db = supabase as any;

async function fetchPrefs(): Promise<Prefs> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return DEFAULTS;
  const { data, error } = await db
    .from("notification_preferences")
    .select("push_enabled, messages, applications, trials, recruitment")
    .eq("profile_id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  return data ?? DEFAULTS;
}

export function NotificationPreferencesSection() {
  const qc = useQueryClient();
  const { data: prefs = DEFAULTS, isLoading } = useQuery({ queryKey: ["notification-preferences"], queryFn: fetchPrefs });
  const save = useMutation({
    mutationFn: async (next: Prefs) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await db
        .from("notification_preferences")
        .upsert({ profile_id: u.user.id, ...next }, { onConflict: "profile_id" });
      if (error) throw error;
      return next;
    },
    onMutate: async (next) => {
      const prev = qc.getQueryData<Prefs>(["notification-preferences"]);
      qc.setQueryData(["notification-preferences"], next);
      return { prev };
    },
    onError: (_e, _n, ctx) => {
      qc.setQueryData(["notification-preferences"], ctx?.prev ?? DEFAULTS);
      toast.error("Couldn't save your notification settings. Please try again.");
    },
  });

  // Master switch is derived: ON when at least one category is ON.
  const allOn = ROWS.some((r) => prefs[r.key]);

  return (
    <Panel>
      <h2 id="notifications" className="scroll-mt-24 font-display text-lg uppercase">Notifications</h2>
      <p className="mt-1 text-sm text-muted-foreground">Choose which notifications you receive in BallFindr.</p>
      <label className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-3">
        <span className="min-w-0">
          <span className="block font-semibold">Push notifications</span>
          <span className="block text-sm text-muted-foreground">Receive BallFindr notifications on your phone.</span>
        </span>
        <Switch
          checked={allOn}
          disabled={isLoading || save.isPending}
          onCheckedChange={(v) =>
            save.mutate({ push_enabled: v, messages: v, applications: v, trials: v, recruitment: v })
          }
          aria-label="Push notifications"
        />
      </label>
      <div className="mt-2 divide-y divide-border">
        {ROWS.map((r) => (
          <label key={r.key} className="flex items-center justify-between gap-4 py-3">
            <span className="min-w-0">
              <span className="block font-semibold">{r.label}</span>
              <span className="block text-sm text-muted-foreground">{r.body}</span>
            </span>
            <Switch
              checked={prefs[r.key]}
              disabled={isLoading || save.isPending}
              onCheckedChange={(v) => {
                const next = { ...prefs, [r.key]: v };
                save.mutate({ ...next, push_enabled: ROWS.some((x) => next[x.key]) });
              }}
              aria-label={r.label}
            />
          </label>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Important account and security notifications, including admin warnings, can't be turned off.
      </p>
      <PhoneNotificationStatus />
    </Panel>
  );
}
