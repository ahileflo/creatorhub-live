-- Pas cu Gust: link public de rețetă.
-- Linkurile sunt „nelistate”: oricine are linkul vede rețeta, dar nimeni nu poate lista toate rețetele distribuite.

-- 1) Rețetele distribuite (o copie a rețetei, cu linkurile publice către poze/clipuri)
create table if not exists public.shared_recipes (
  id         text primary key check (id ~ '^[A-Za-z0-9]{8,16}$'),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id  text not null,
  data       jsonb not null check (pg_column_size(data) < 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner, recipe_id)
);

alter table public.shared_recipes enable row level security;

-- Autorul își vede, creează, modifică și șterge doar linkurile lui.
create policy "shared_recipes: autorul își vede linkurile"
  on public.shared_recipes for select to authenticated
  using ((select auth.uid()) = owner);

create policy "shared_recipes: autorul creează"
  on public.shared_recipes for insert to authenticated
  with check ((select auth.uid()) = owner);

create policy "shared_recipes: autorul modifică"
  on public.shared_recipes for update to authenticated
  using ((select auth.uid()) = owner)
  with check ((select auth.uid()) = owner);

create policy "shared_recipes: autorul șterge"
  on public.shared_recipes for delete to authenticated
  using ((select auth.uid()) = owner);

-- 2) Citirea publică doar după id (fără listare, fără id-ul autorului)
create or replace function public.get_shared_recipe(share_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select data || jsonb_build_object('shared_at', updated_at)
  from public.shared_recipes
  where id = share_id;
$$;

revoke execute on function public.get_shared_recipe(text) from public;
grant execute on function public.get_shared_recipe(text) to anon, authenticated;

-- 3) Pozele și clipurile rețetelor distribuite: bucket public (citire prin URL), scriere doar în folderul propriu
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pascugust-public', 'pascugust-public', true, 52428800, array['image/*', 'video/*'])
on conflict (id) do nothing;

create policy "pascugust-public: autorul își listează fișierele"
  on storage.objects for select to authenticated
  using (bucket_id = 'pascugust-public' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "pascugust-public: autorul urcă în folderul lui"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'pascugust-public' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "pascugust-public: autorul modifică"
  on storage.objects for update to authenticated
  using (bucket_id = 'pascugust-public' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "pascugust-public: autorul șterge"
  on storage.objects for delete to authenticated
  using (bucket_id = 'pascugust-public' and (storage.foldername(name))[1] = (select auth.uid())::text);
