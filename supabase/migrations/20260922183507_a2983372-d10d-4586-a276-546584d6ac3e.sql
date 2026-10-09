
-- Snapshot columns so moderation/audit records survive account deletion
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reported_display_name text,
  ADD COLUMN IF NOT EXISTS reporter_display_name text;

ALTER TABLE public.moderation_actions
  ADD COLUMN IF NOT EXISTS subject_display_name text,
  ADD COLUMN IF NOT EXISTS admin_display_name text;

-- Reports: keep the record, drop the link when the account goes
ALTER TABLE public.reports ALTER COLUMN reported_profile_id DROP NOT NULL;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reported_profile_id_fkey;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_reported_profile_id_fkey
  FOREIGN KEY (reported_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Moderation audit: keep every action, unlink deleted accounts
ALTER TABLE public.moderation_actions ALTER COLUMN admin_profile_id DROP NOT NULL;
ALTER TABLE public.moderation_actions DROP CONSTRAINT IF EXISTS moderation_actions_admin_profile_id_fkey;
ALTER TABLE public.moderation_actions
  ADD CONSTRAINT moderation_actions_admin_profile_id_fkey
  FOREIGN KEY (admin_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.moderation_actions DROP CONSTRAINT IF EXISTS moderation_actions_subject_profile_id_fkey;
ALTER TABLE public.moderation_actions
  ADD CONSTRAINT moderation_actions_subject_profile_id_fkey
  FOREIGN KEY (subject_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Restrictions: the acting admin's account may be deleted later
ALTER TABLE public.account_restrictions DROP CONSTRAINT IF EXISTS account_restrictions_created_by_fkey;
ALTER TABLE public.account_restrictions
  ADD CONSTRAINT account_restrictions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.account_restrictions DROP CONSTRAINT IF EXISTS account_restrictions_lifted_by_fkey;
ALTER TABLE public.account_restrictions
  ADD CONSTRAINT account_restrictions_lifted_by_fkey
  FOREIGN KEY (lifted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Backfill the name snapshots for existing records
UPDATE public.reports r SET reported_display_name = p.display_name
  FROM public.profiles p WHERE p.id = r.reported_profile_id AND r.reported_display_name IS NULL;
UPDATE public.reports r SET reporter_display_name = p.display_name
  FROM public.profiles p WHERE p.id = r.reporter_profile_id AND r.reporter_display_name IS NULL;
UPDATE public.moderation_actions m SET subject_display_name = p.display_name
  FROM public.profiles p WHERE p.id = m.subject_profile_id AND m.subject_display_name IS NULL;
UPDATE public.moderation_actions m SET admin_display_name = p.display_name
  FROM public.profiles p WHERE p.id = m.admin_profile_id AND m.admin_display_name IS NULL;
