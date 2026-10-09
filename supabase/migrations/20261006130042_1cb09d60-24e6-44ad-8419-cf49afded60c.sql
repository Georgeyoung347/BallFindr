CREATE VIEW public.player_share_slugs AS
  SELECT p.id, p.slug
  FROM public.players p
  WHERE p.slug IS NOT NULL
    AND private.account_visible(p.id)
    AND private.profile_is_type(p.id, 'player'::public.account_type);

GRANT SELECT ON public.player_share_slugs TO authenticated;

CREATE VIEW public.club_share_slugs AS
  SELECT c.id, c.slug
  FROM public.clubs c
  WHERE c.slug IS NOT NULL
    AND private.account_visible(c.id)
    AND private.can_view_club(c.id)
    AND private.profile_is_type(c.id, 'club'::public.account_type);

GRANT SELECT ON public.club_share_slugs TO authenticated;