-- Recikeep: cont + sincronizare în cloud.
-- Rulează o singură dată în Supabase → SQL Editor (sau `supabase db push`).

-- 1) Starea fiecărui utilizator (rețete, serie, produse) ca un singur document JSON
create table if not exists public.recikeep_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.recikeep_state enable row level security;

create policy "recikeep_state: citesc doar ale mele"
  on public.recikeep_state for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "recikeep_state: adaug doar ale mele"
  on public.recikeep_state for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "recikeep_state: modific doar ale mele"
  on public.recikeep_state for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "recikeep_state: șterg doar ale mele"
  on public.recikeep_state for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 2) Pozele, GIF-urile și clipurile: bucket privat, fiecare utilizator în folderul lui (<user_id>/<media_id>)
insert into storage.buckets (id, name, public, file_size_limit)
values ('recikeep-media', 'recikeep-media', false, 52428800) -- 50 MB / fișier (limita planului Free)
on conflict (id) do nothing;

create policy "recikeep-media: citesc doar ale mele"
  on storage.objects for select to authenticated
  using (bucket_id = 'recikeep-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "recikeep-media: urc doar în folderul meu"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'recikeep-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "recikeep-media: modific doar ale mele"
  on storage.objects for update to authenticated
  using (bucket_id = 'recikeep-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "recikeep-media: șterg doar ale mele"
  on storage.objects for delete to authenticated
  using (bucket_id = 'recikeep-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 3) Ștergerea contului din aplicație (cerută de Google Play și App Store).
-- Fișierele se șterg din aplicație prin Storage API înainte de apel; rândul din recikeep_state dispare prin cascadă.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
