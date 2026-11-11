-- Pas cu Gust: creștere — profiluri, referral pe 2 niveluri, Premium, statistici anonime,
-- aprecieri și comentarii la rețetele distribuite, vânzări Gumroad și panoul de administrare.
-- Tabelele se scriu doar prin funcțiile de mai jos; clientul nu are drept direct de scriere.

create schema if not exists private;  -- nu e expusă prin API
revoke all on schema private from public, anon, authenticated;

-- ---------- profiluri ----------
create table if not exists public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  ref_code       text unique not null default lower(substr(md5(gen_random_uuid()::text), 1, 8)),
  referred_by    uuid references auth.users (id) on delete set null,
  premium_until  timestamptz,
  premium_source text,
  created_at     timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: îmi văd profilul" on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.referrals (
  id          bigserial primary key,
  referrer    uuid not null references auth.users (id) on delete cascade,
  referee     uuid not null references auth.users (id) on delete cascade,
  level       smallint not null check (level in (1, 2)),
  reward_days int not null,
  created_at  timestamptz not null default now(),
  unique (referee, level)
);
create index if not exists referrals_referrer on public.referrals (referrer, created_at);
alter table public.referrals enable row level security;
create policy "referrals: îi văd pe cei aduși de mine" on public.referrals for select to authenticated
  using ((select auth.uid()) = referrer);

-- Zile de Premium, plafonate la un an în avans (ca să nu se poată „fabrica” la nesfârșit).
create or replace function private.add_premium(uid uuid, days int, src text)
returns void language sql security definer set search_path = '' as $$
  update public.profiles
     set premium_until = least(greatest(coalesce(premium_until, now()), now()) + make_interval(days => days),
                               now() + interval '366 days'),
         premium_source = src
   where user_id = uid and days > 0;
$$;

create or replace function public.my_profile()
returns json language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); p public.profiles;
begin
  if me is null then return null; end if;
  insert into public.profiles (user_id) values (me) on conflict do nothing;
  select * into p from public.profiles where user_id = me;
  return json_build_object(
    'ref_code', p.ref_code,
    'premium_until', p.premium_until,
    'premium', coalesce(p.premium_until > now(), false),
    'referred', p.referred_by is not null,
    'invited_l1', (select count(*) from public.referrals where referrer = me and level = 1),
    'invited_l2', (select count(*) from public.referrals where referrer = me and level = 2),
    'days_earned', (select coalesce(sum(reward_days), 0) from public.referrals where referrer = me));
end $$;

-- Recompense: tu +30 zile, cine te-a invitat +30 zile, cel care l-a invitat pe el +7 zile.
-- Doar o dată per cont, doar în primele 7 zile de la crearea contului, maximum 50 de recompense pe lună per invitator.
create or replace function public.claim_referral(code text)
returns json language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); ref uuid; lvl2 uuid; recent int;
begin
  if me is null then return json_build_object('ok', false, 'reason', 'auth'); end if;
  insert into public.profiles (user_id) values (me) on conflict do nothing;
  if (select referred_by from public.profiles where user_id = me) is not null then
    return json_build_object('ok', false, 'reason', 'already'); end if;
  if (select created_at from auth.users where id = me) < now() - interval '7 days' then
    return json_build_object('ok', false, 'reason', 'too_late'); end if;
  select user_id into ref from public.profiles where ref_code = lower(trim(code));
  if ref is null then return json_build_object('ok', false, 'reason', 'invalid'); end if;
  if ref = me then return json_build_object('ok', false, 'reason', 'self'); end if;
  update public.profiles set referred_by = ref where user_id = me;
  select count(*) into recent from public.referrals
   where referrer = ref and level = 1 and created_at > now() - interval '30 days';
  insert into public.referrals (referrer, referee, level, reward_days) values (ref, me, 1, case when recent < 50 then 30 else 0 end);
  perform private.add_premium(me, 30, 'invitație');
  if recent < 50 then perform private.add_premium(ref, 30, 'invitație'); end if;
  select referred_by into lvl2 from public.profiles where user_id = ref;
  if lvl2 is not null and lvl2 <> me then
    insert into public.referrals (referrer, referee, level, reward_days) values (lvl2, me, 2, 7) on conflict do nothing;
    perform private.add_premium(lvl2, 7, 'invitație nivel 2');
  end if;
  return json_build_object('ok', true, 'days', 30);
end $$;

-- ---------- statistici anonime (fără identificatori de persoană) ----------
create table if not exists public.events (
  id     bigserial primary key,
  at     timestamptz not null default now(),
  name   text not null check (name in ('open','feed_view','view','cook','cooked','share','save','gif','video',
                                       'install','signup','link_open','comment','like','premium')),
  recipe text check (char_length(recipe) <= 40),
  lang   text check (char_length(lang) <= 5),
  src    text check (char_length(src) <= 20)
);
create index if not exists events_name_at on public.events (name, at);
alter table public.events enable row level security;
create policy "events: oricine poate trimite un eveniment" on public.events for insert to anon, authenticated
  with check (true);

-- ---------- aprecieri și comentarii la rețetele distribuite ----------
create table if not exists public.share_likes (
  share_id   text not null references public.shared_recipes (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (share_id, user_id)
);
alter table public.share_likes enable row level security;

create table if not exists public.share_comments (
  id         bigserial primary key,
  share_id   text not null references public.shared_recipes (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists share_comments_share on public.share_comments (share_id, created_at);
alter table public.share_comments enable row level security;

create or replace function public.get_social(share_id text)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'likes', (select count(*) from public.share_likes l where l.share_id = get_social.share_id),
    'liked', exists (select 1 from public.share_likes l where l.share_id = get_social.share_id and l.user_id = (select auth.uid())),
    'comments', coalesce((select json_agg(c order by c.at) from (
        select sc.id, sc.name, sc.body, sc.created_at as at,
               sc.user_id = (select auth.uid()) as mine,
               (sc.user_id = (select auth.uid()) or sr.owner = (select auth.uid())) as can_delete
          from public.share_comments sc join public.shared_recipes sr on sr.id = sc.share_id
         where sc.share_id = get_social.share_id
         order by sc.created_at desc limit 100) c), '[]'::json));
$$;

create or replace function public.toggle_like(share_id text)
returns json language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'auth'; end if;
  if exists (select 1 from public.share_likes l where l.share_id = toggle_like.share_id and l.user_id = me) then
    delete from public.share_likes l where l.share_id = toggle_like.share_id and l.user_id = me;
  else
    insert into public.share_likes (share_id, user_id) values (toggle_like.share_id, me);
  end if;
  return public.get_social(toggle_like.share_id);
end $$;

-- Maximum 10 comentarii pe oră per cont, ca să nu se poată umple de spam.
create or replace function public.post_comment(share_id text, name text, body text)
returns json language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'auth'; end if;
  if (select count(*) from public.share_comments c where c.user_id = me and c.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limit'; end if;
  insert into public.share_comments (share_id, user_id, name, body)
    values (post_comment.share_id, me, left(trim(post_comment.name), 40), left(trim(post_comment.body), 500));
  return public.get_social(post_comment.share_id);
end $$;

-- Șterge comentariul propriu sau orice comentariu de la rețeta ta.
create or replace function public.delete_comment(comment_id bigint)
returns json language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); sid text;
begin
  select c.share_id into sid from public.share_comments c join public.shared_recipes r on r.id = c.share_id
   where c.id = comment_id and (c.user_id = me or r.owner = me);
  if sid is null then raise exception 'forbidden'; end if;
  delete from public.share_comments where id = comment_id;
  return public.get_social(sid);
end $$;

-- ---------- Premium prin Gumroad, vânzări ----------
create table if not exists private.config (key text primary key, value text not null);
create table if not exists private.admins (email text primary key);
create table if not exists private.licenses (
  license_hash text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now()
);
create table if not exists private.sales (
  sale_id         text primary key,
  at              timestamptz not null default now(),
  product         text,
  price_cents     int,
  currency        text,
  affiliate       boolean not null default false,
  affiliate_cents int not null default 0,
  refunded        boolean not null default false
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.admins where lower(email) = lower((select auth.jwt()) ->> 'email'));
$$;

-- Panoul de creștere: doar pentru administratori.
create or replace function public.growth_stats(days int default 30)
returns json language plpgsql stable security definer set search_path = '' as $$
declare since timestamptz := date_trunc('day', now()) - make_interval(days => greatest(1, least(days, 365)) - 1);
begin
  if not public.is_admin() then return null; end if;
  return json_build_object(
    'since', since,
    'users_total', (select count(*) from auth.users),
    'users_by_day', (select coalesce(json_object_agg(d, n), '{}') from (select to_char(created_at, 'YYYY-MM-DD') d, count(*) n from auth.users where created_at >= since group by 1) x),
    'premium_active', (select count(*) from public.profiles where premium_until > now()),
    'referrals', json_build_object(
       'l1', (select count(*) from public.referrals where level = 1),
       'l2', (select count(*) from public.referrals where level = 2),
       'by_day', (select coalesce(json_object_agg(d, n), '{}') from (select to_char(created_at, 'YYYY-MM-DD') d, count(*) n from public.referrals where created_at >= since and level = 1 group by 1) x)),
    'events', (select coalesce(json_object_agg(name, days_), '{}') from (
       select name, json_object_agg(d, n) days_ from (
         select name, to_char(at, 'YYYY-MM-DD') d, count(*) n from public.events where at >= since group by 1, 2) y group by name) x),
    'events_total', (select coalesce(json_object_agg(name, n), '{}') from (select name, count(*) n from public.events where at >= since group by 1) x),
    'top_recipes', (select coalesce(json_agg(x), '[]') from (
       select recipe, count(*) filter (where name in ('view','feed_view')) views, count(*) filter (where name = 'save') saves,
              count(*) filter (where name in ('cook','cooked')) cooks, count(*) filter (where name = 'share') shares
         from public.events where at >= since and recipe is not null group by recipe order by 2 desc limit 10) x),
    'langs', (select coalesce(json_object_agg(lang, n), '{}') from (select lang, count(*) n from public.events where at >= since and name = 'open' and lang is not null group by 1) x),
    'shared_links', (select count(*) from public.shared_recipes),
    'likes', (select count(*) from public.share_likes),
    'comments', (select count(*) from public.share_comments),
    'sales', json_build_object(
       'count', (select count(*) from private.sales where not refunded and at >= since),
       'gross_cents', (select coalesce(sum(price_cents), 0) from private.sales where not refunded and at >= since),
       'affiliate_cents', (select coalesce(sum(affiliate_cents), 0) from private.sales where not refunded and at >= since),
       'affiliate_sales', (select count(*) from private.sales where not refunded and affiliate and at >= since),
       'currency', (select currency from private.sales order by at desc limit 1),
       'by_day', (select coalesce(json_object_agg(d, c), '{}') from (select to_char(at, 'YYYY-MM-DD') d, sum(price_cents) c from private.sales where not refunded and at >= since group by 1) x)));
end $$;

-- Funcțiile publice: doar utilizatori logați, cu excepția citirii comentariilor.
revoke execute on function public.my_profile(), public.claim_referral(text), public.toggle_like(text),
  public.post_comment(text, text, text), public.delete_comment(bigint), public.growth_stats(int), public.is_admin(),
  public.get_social(text) from public, anon;
grant execute on function public.my_profile(), public.claim_referral(text), public.toggle_like(text),
  public.post_comment(text, text, text), public.delete_comment(bigint), public.growth_stats(int), public.is_admin(),
  public.get_social(text) to authenticated;
grant execute on function public.get_social(text) to anon;
revoke execute on function private.add_premium(uuid, int, text) from public, anon, authenticated;

-- ---------- funcții doar pentru serverul aplicației (edge functions, cheia service_role) ----------
create or replace function public.svc_config(k text)
returns text language sql stable security definer set search_path = '' as $$
  select value from private.config where key = k;
$$;

-- O cheie de licență Gumroad activează Premium pe un singur cont.
create or replace function public.svc_grant_license(uid uuid, lic_hash text, days int, src text)
returns json language plpgsql security definer set search_path = '' as $$
declare owner_ uuid;
begin
  select user_id into owner_ from private.licenses where license_hash = lic_hash;
  if owner_ is not null and owner_ <> uid then return json_build_object('ok', false, 'reason', 'used'); end if;
  insert into public.profiles (user_id) values (uid) on conflict do nothing;
  insert into private.licenses (license_hash, user_id) values (lic_hash, uid) on conflict do nothing;
  update public.profiles set premium_until = greatest(coalesce(premium_until, now()), now() + make_interval(days => days)),
                             premium_source = src where user_id = uid;
  return json_build_object('ok', true, 'premium_until', (select premium_until from public.profiles where user_id = uid));
end $$;

-- Vânzare raportată de Gumroad (Ping).
create or replace function public.svc_record_sale(p jsonb)
returns json language plpgsql security definer set search_path = '' as $$
declare seller text := (select value from private.config where key = 'gumroad_seller_id');
begin
  -- adresa Ping e protejată de un cod secret; contul de vânzător e o verificare în plus, dacă e setat
  if seller is not null and seller <> (p ->> 'seller_id') then return json_build_object('ok', false, 'reason', 'seller'); end if;
  insert into private.sales (sale_id, at, product, price_cents, currency, affiliate, affiliate_cents, refunded)
  values (p ->> 'sale_id', coalesce((p ->> 'sale_timestamp')::timestamptz, now()), left(p ->> 'product_name', 120),
          nullif(p ->> 'price', '')::int, lower(p ->> 'currency'),
          coalesce(nullif(p ->> 'affiliate', ''), '') <> '', coalesce(nullif(p ->> 'affiliate_credit_amount_cents', '')::int, 0),
          coalesce((p ->> 'refunded')::boolean, false))
  on conflict (sale_id) do update set refunded = excluded.refunded;
  return json_build_object('ok', true);
end $$;

revoke execute on function public.svc_config(text), public.svc_grant_license(uuid, text, int, text), public.svc_record_sale(jsonb)
  from public, anon, authenticated;
grant execute on function public.svc_config(text), public.svc_grant_license(uuid, text, int, text), public.svc_record_sale(jsonb)
  to service_role;

-- Reînnoirea abonamentului (Gumroad Ping cu aceeași cheie de licență) prelungește Premium.
create or replace function public.svc_extend_license(lic_hash text, days int)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select user_id from private.licenses where license_hash = lic_hash);
begin
  if uid is null then return json_build_object('ok', false, 'reason', 'unknown'); end if;
  update public.profiles set premium_until = greatest(coalesce(premium_until, now()), now() + make_interval(days => days)),
                             premium_source = 'gumroad:reînnoire' where user_id = uid;
  return json_build_object('ok', true);
end $$;
revoke execute on function public.svc_extend_license(text, int) from public, anon, authenticated;
grant execute on function public.svc_extend_license(text, int) to service_role;

-- Codul secret din adresa Ping (generat o singură dată, nu e salvat în cod).
insert into private.config (key, value) values ('gumroad_ping_secret', encode(gen_random_bytes(24), 'hex')) on conflict (key) do nothing;
