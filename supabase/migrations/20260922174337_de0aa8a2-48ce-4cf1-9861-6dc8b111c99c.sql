-- Minimum age (16+) enforced in the database, not only in the browser.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_type text;
  v_name text;
  v_dob date;
begin
  v_type := coalesce(new.raw_user_meta_data->>'account_type', 'player');
  v_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'user'), '@', 1));

  begin
    v_dob := nullif(btrim(coalesce(new.raw_user_meta_data->>'date_of_birth', '')), '')::date;
  exception when others then
    v_dob := null;
  end;

  if v_dob is not null and v_dob > (current_date - interval '16 years') then
    raise exception 'You must be 16 or over to use BallFindr';
  end if;

  insert into public.profiles (id, account_type, display_name)
  values (new.id, v_type::public.account_type, v_name);

  if v_type = 'club' then
    insert into public.clubs (id, name) values (new.id, v_name);
  else
    insert into public.players (id) values (new.id);
    if v_dob is not null then
      insert into public.player_private (player_id, date_of_birth)
      values (new.id, v_dob)
      on conflict (player_id) do update set date_of_birth = excluded.date_of_birth;
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.enforce_minimum_age()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.date_of_birth is not null
     and new.date_of_birth > (current_date - interval '16 years') then
    raise exception 'You must be 16 or over to use BallFindr';
  end if;
  return new;
end $function$;

DROP TRIGGER IF EXISTS enforce_minimum_age ON public.player_private;
CREATE TRIGGER enforce_minimum_age
  BEFORE INSERT OR UPDATE ON public.player_private
  FOR EACH ROW EXECUTE FUNCTION public.enforce_minimum_age();

REVOKE ALL ON FUNCTION public.enforce_minimum_age() FROM public, anon, authenticated;