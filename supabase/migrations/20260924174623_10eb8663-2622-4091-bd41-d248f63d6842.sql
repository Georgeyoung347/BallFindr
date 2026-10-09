ALTER TABLE public.club_history
  ADD COLUMN IF NOT EXISTS wins integer,
  ADD COLUMN IF NOT EXISTS draws integer,
  ADD COLUMN IF NOT EXISTS losses integer;
ALTER TABLE public.club_history
  ADD CONSTRAINT club_history_wins_nonneg CHECK (wins IS NULL OR (wins >= 0 AND wins <= 999)),
  ADD CONSTRAINT club_history_draws_nonneg CHECK (draws IS NULL OR (draws >= 0 AND draws <= 999)),
  ADD CONSTRAINT club_history_losses_nonneg CHECK (losses IS NULL OR (losses >= 0 AND losses <= 999));