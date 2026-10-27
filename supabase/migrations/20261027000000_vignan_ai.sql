-- Vignan Vidyanikethan AI — Supabase schema for accounts, progress and sessions.
-- Run this in the Supabase SQL editor or via `supabase db push` before setting
-- STUDY_AI_ACCOUNTS_BACKEND=supabase on Render.

-- 1. Student profiles -------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_-]{3,20}$'),
  age_band text not null check (age_band in ('under-13', '13-15', '16-18', '19+')),
  gender text not null check (gender in ('girl', 'boy', 'other', 'prefer-not')),
  guardian_consent boolean not null default false,
  avatar_seed bigint not null default 0,
  xp integer not null default 0 check (xp >= 0),
  streak integer not null default 0 check (streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  best integer not null default 0 check (best between 0 and 100),
  quizzes integer not null default 0 check (quizzes >= 0),
  total_correct numeric not null default 0 check (total_correct >= 0),
  total_questions integer not null default 0 check (total_questions >= 0),
  average numeric not null default 0 check (average between 0 and 100),
  referrals integer not null default 0 check (referrals >= 0),
  referred_by text,
  last_result_day date,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_leaderboard_idx
  on public.profiles (best desc, xp desc, streak desc, quizzes desc);

alter table public.profiles enable row level security;

drop policy if exists "vignan_service_role_profiles" on public.profiles;
create policy "vignan_service_role_profiles"
  on public.profiles for all
  to service_role using (true) with check (true);

revoke all on public.profiles from anon, authenticated;
grant all on public.profiles to service_role;

comment on table public.profiles is
  'Vignan Vidyanikethan AI student profiles. Exact age and gender are private; only safe leaderboard fields leave the server.';

-- 2. Persistent sessions ----------------------------------------------------

create table if not exists public.sessions (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_expires_idx on public.sessions (expires_at);

alter table public.sessions enable row level security;

drop policy if exists "vignan_service_role_sessions" on public.sessions;
create policy "vignan_service_role_sessions"
  on public.sessions for all
  to service_role using (true) with check (true);

revoke all on public.sessions from anon, authenticated;
grant all on public.sessions to service_role;

-- 3. Create a profile automatically after Supabase Auth creates a user ------

create or replace function public.handle_new_vignan_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_username text := lower(new.raw_user_meta_data->>'username');
  v_referred_by text := nullif(lower(new.raw_user_meta_data->>'referred_by'), '');
begin
  insert into public.profiles (
    id, username, age_band, gender, guardian_consent, avatar_seed, referred_by
  )
  values (
    new.id,
    v_username,
    coalesce(new.raw_user_meta_data->>'age_band', '13-15'),
    coalesce(new.raw_user_meta_data->>'gender', 'prefer-not'),
    coalesce((new.raw_user_meta_data->>'guardian_consent')::boolean, false),
    coalesce((new.raw_user_meta_data->>'avatar_seed')::bigint, 0),
    v_referred_by
  );

  if v_referred_by is not null then
    update public.profiles
       set referrals = referrals + 1, updated_at = now()
     where username = v_referred_by and id <> new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_vignan on auth.users;
create trigger on_auth_user_created_vignan
  after insert on auth.users
  for each row execute function public.handle_new_vignan_user();

-- 4. Atomic quiz-result recording -------------------------------------------

create or replace function public.record_vignan_result(
  p_user_id uuid,
  p_topic text,
  p_percent integer,
  p_score numeric,
  p_total integer,
  p_xp integer,
  p_day date
) returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.profiles;
  v_streak integer;
  v_best_streak integer;
  v_total_correct numeric;
  v_total_questions integer;
  v_average numeric;
  v_entry jsonb;
  v_percent integer := greatest(0, least(100, coalesce(p_percent, 0)));
  v_score numeric := greatest(0, coalesce(p_score, 0));
  v_total integer := greatest(0, coalesce(p_total, 0));
  v_xp integer := greatest(0, coalesce(p_xp, 0));
begin
  select * into v_current from public.profiles where id = p_user_id for update;
  if not found then
    return null;
  end if;

  if v_current.last_result_day = p_day then
    v_streak := v_current.streak;
  elsif v_current.last_result_day = p_day - 1 then
    v_streak := v_current.streak + 1;
  else
    v_streak := 1;
  end if;

  v_best_streak := greatest(v_current.best_streak, v_streak);
  v_total_correct := v_current.total_correct + v_score;
  v_total_questions := v_current.total_questions + v_total;
  v_average := case when v_total_questions > 0
    then round(100.0 * v_total_correct / v_total_questions, 2)
    else 0 end;

  v_entry := jsonb_build_object(
    'topic', left(coalesce(p_topic, 'Chapter quiz'), 120),
    'percent', v_percent,
    'day', p_day,
    'date', now()
  );

  update public.profiles
     set xp = xp + v_xp,
         streak = v_streak,
         best_streak = v_best_streak,
         best = greatest(best, v_percent),
         quizzes = quizzes + 1,
         total_correct = v_total_correct,
         total_questions = v_total_questions,
         average = v_average,
         last_result_day = p_day,
         history = jsonb_build_array(v_entry) || history,
         updated_at = now()
   where id = p_user_id
  returning * into v_current;

  update public.profiles
     set history = (
       select coalesce(jsonb_agg(entry), '[]'::jsonb)
       from (
         select entry
           from jsonb_array_elements(v_current.history) with ordinality as t(entry, ord)
          order by ord
          limit 10
       ) s
     )
   where id = p_user_id
  returning * into v_current;

  return v_current;
end;
$$;

revoke all on function public.record_vignan_result(uuid, text, integer, numeric, integer, integer, date) from public;
grant execute on function public.record_vignan_result(uuid, text, integer, numeric, integer, integer, date) to service_role;

-- 5. Session helpers --------------------------------------------------------

create or replace function public.create_vignan_session(
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.sessions where expires_at < now();
  insert into public.sessions (token_hash, user_id, expires_at)
  values (p_token_hash, p_user_id, p_expires_at)
  on conflict (token_hash) do update
    set user_id = excluded.user_id, expires_at = excluded.expires_at;
end;
$$;

create or replace function public.get_vignan_session(p_token_hash text)
returns table (user_id uuid, expires_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select user_id, expires_at
    from public.sessions
   where token_hash = p_token_hash and expires_at > now();
$$;

create or replace function public.delete_vignan_session(p_token_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.sessions where token_hash = p_token_hash;
$$;

revoke all on function public.create_vignan_session(uuid, text, timestamptz) from public;
revoke all on function public.get_vignan_session(text) from public;
revoke all on function public.delete_vignan_session(text) from public;
grant execute on function public.create_vignan_session(uuid, text, timestamptz) to service_role;
grant execute on function public.get_vignan_session(text) to service_role;
grant execute on function public.delete_vignan_session(text) to service_role;
