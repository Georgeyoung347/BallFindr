GRANT SELECT ON public.player_share_slugs TO authenticated;
GRANT SELECT ON public.club_share_slugs TO authenticated;
GRANT SELECT (id, slug) ON public.players TO authenticated;
GRANT SELECT (id, slug) ON public.clubs TO authenticated;