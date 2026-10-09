CREATE OR REPLACE FUNCTION public.get_public_player(_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'slug', pl.slug, 'name', pr.display_name, 'avatarPath', pr.avatar_path,
    'isVerified', pr.verification_status = 'verified', 'isOwner', pr.is_owner,
    'primaryPosition', pl.primary_position, 'secondaryPositions', coalesce(to_jsonb(pl.secondary_positions), '[]'::jsonb),
    'availability', pl.availability,
    'level', (select name from public.levels where id = pl.level_id),
    'preferredLevel', (select name from public.levels where id = pl.preferred_level_id),
    'openToTrials', pl.open_to_trials)
  from public.players pl join public.profiles pr on pr.id = pl.id
  where pl.slug = _slug and private.publicly_listed(pl.id, 'player')
$function$;