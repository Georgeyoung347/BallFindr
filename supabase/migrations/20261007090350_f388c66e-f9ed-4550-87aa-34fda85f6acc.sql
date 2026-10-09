CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_type text;
  v_name text;
  v_dob date;
  v_section public.football_section;
begin
  v_type := coalesce(new.raw_user_meta_data->>'account_type', 'player');
  v_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'user'), '@', 1));

  begin
    v_dob := nullif(btrim(coalesce(new.raw_user_meta_data->>'date_of_birth', '')), '')::date;
  exception when others then
    v_dob := null;
  end;

  begin
    v_section := coalesce(nullif(btrim(coalesce(new.raw_user_meta_data->>'football_section', '')), ''), 'mens')::public.football_section;
  exception when others then
    v_section := 'mens';
  end;

  -- 16+ rule: player accounts require a valid DOB; missing/invalid fails closed.
  if v_type <> 'club' then
    if v_dob is null or v_dob < date '1900-01-01' or v_dob > current_date then
      raise exception 'A valid date of birth is required to use BallFindr';
    end if;
    if v_dob > (current_date - interval '16 years')::date then
      raise exception 'You must be 16 or over to use BallFindr';
    end if;
  elsif v_dob is not null and v_dob > (current_date - interval '16 years')::date then
    raise exception 'You must be 16 or over to use BallFindr';
  end if;

  insert into public.profiles (id, account_type, display_name)
  values (new.id, v_type::public.account_type, v_name);

  if v_type = 'club' then
    insert into public.clubs (id, name, football_section, active_section)
    values (new.id, v_name, v_section, case when v_section = 'both' then 'mens' else v_section end);
  else
    if v_section = 'both' then v_section := 'mens'; end if;
    insert into public.players (id, football_section) values (new.id, v_section);
    insert into public.player_private (player_id, date_of_birth)
    values (new.id, v_dob)
    on conflict (player_id) do update set date_of_birth = excluded.date_of_birth;
  end if;
  return new;
end $function$;