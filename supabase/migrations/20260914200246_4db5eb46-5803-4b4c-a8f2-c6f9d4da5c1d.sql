drop policy if exists "Authenticated users can record views" on public.profile_views;
create policy "Clubs record player views; club profile views unchanged"
on public.profile_views for insert to authenticated
with check (
  viewer_profile_id = auth.uid()
  and viewer_profile_id <> viewed_profile_id
  and (
    exists (select 1 from public.profiles v where v.id = auth.uid() and v.account_type = 'club')
    or exists (select 1 from public.profiles t where t.id = viewed_profile_id and t.account_type = 'club')
  )
);