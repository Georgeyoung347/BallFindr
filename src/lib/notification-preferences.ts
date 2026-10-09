/**
 * Shared fetch for the ["notification-preferences"] query, used by both the
 * Settings section and the AppShell menu reminder so the cache always holds
 * the same shape. No saved row means every category is on (DEFAULTS).
 */
import { supabase } from "@/integrations/supabase/client";

export type NotificationPrefKey = "messages" | "applications" | "trials" | "recruitment";
export type NotificationPrefs = Record<NotificationPrefKey, boolean> & { push_enabled: boolean };

export const NOTIFICATION_PREFS_QUERY_KEY = ["notification-preferences"] as const;

export const NOTIFICATION_PREF_DEFAULTS: NotificationPrefs = {
  push_enabled: true,
  messages: true,
  applications: true,
  trials: true,
  recruitment: true,
};

export async function fetchNotificationPreferences(): Promise<NotificationPrefs> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NOTIFICATION_PREF_DEFAULTS;
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("push_enabled, messages, applications, trials, recruitment")
    .eq("profile_id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  return data ?? NOTIFICATION_PREF_DEFAULTS;
}
