ALTER TABLE public.player_history
  ADD COLUMN IF NOT EXISTS clean_sheets integer,
  ADD COLUMN IF NOT EXISTS goals_against integer;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS fees_policy text,
  ADD COLUMN IF NOT EXISTS match_subs_fee numeric(8,2),
  ADD COLUMN IF NOT EXISTS monthly_fee numeric(8,2),
  ADD COLUMN IF NOT EXISTS yearly_fee numeric(8,2),
  ADD COLUMN IF NOT EXISTS other_fee numeric(8,2),
  ADD COLUMN IF NOT EXISTS other_fee_label text,
  ADD COLUMN IF NOT EXISTS facilities text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS facilities_other text;

ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_fees_policy_check
  CHECK (fees_policy IS NULL OR fees_policy IN ('none', 'varies', 'listed'));

GRANT SELECT (fees_policy, match_subs_fee, monthly_fee, yearly_fee, other_fee, other_fee_label, facilities, facilities_other) ON public.clubs TO authenticated;
GRANT UPDATE (fees_policy, match_subs_fee, monthly_fee, yearly_fee, other_fee, other_fee_label, facilities, facilities_other) ON public.clubs TO authenticated;
