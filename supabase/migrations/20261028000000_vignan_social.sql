-- Friends, notifications, chat and multiplayer games for Vignan Vidyanikethan AI.
--
-- The browser never talks to these tables. Every read and write goes through
-- the Node server holding the service-role key, which enforces friendship,
-- privacy and turn rules. RLS is enabled with no public policy, so the anon
-- key can neither read nor write here.

create extension if not exists pgcrypto;

-- Searchable directory of students who have opened the social screens.
create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  avatar_seed text not null default '',
  xp integer not null default 0,
  streak integer not null default 0,
  last_seen timestamptz not null default now()
);

create unique index if not exists social_profiles_username_key on public.social_profiles (lower(username));
create index if not exists social_profiles_xp_idx on public.social_profiles (xp desc);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references auth.users (id) on delete cascade,
  from_name text not null,
  to_id uuid not null references auth.users (id) on delete cascade,
  to_name text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  constraint friend_requests_not_self check (from_id <> to_id)
);

create unique index if not exists friend_requests_pending_key
  on public.friend_requests (from_id, to_id) where status = 'pending';
create index if not exists friend_requests_to_idx on public.friend_requests (to_id, status);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  name_a text not null,
  name_b text not null,
  created_at timestamptz not null default now(),
  constraint friendships_order check (user_a < user_b)
);

create unique index if not exists friendships_pair_key on public.friendships (user_a, user_b);
create index if not exists friendships_b_idx on public.friendships (user_b);

create table if not exists public.social_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists social_notifications_user_idx on public.social_notifications (user_id, created_at desc);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'dm' check (kind in ('dm', 'hall')),
  title text not null default '',
  member_a uuid references auth.users (id) on delete cascade,
  member_b uuid references auth.users (id) on delete cascade,
  name_a text not null default '',
  name_b text not null default '',
  last_at timestamptz not null default now(),
  last_preview text not null default ''
);

-- The Study Hall is a single shared room with a fixed id.
insert into public.chat_threads (id, kind, title, last_preview)
values ('00000000-0000-4000-8000-000000000001', 'hall', 'Study Hall',
        'Everyone signed in can talk here. Keep it academic.')
on conflict (id) do nothing;

create unique index if not exists chat_threads_dm_key
  on public.chat_threads (member_a, member_b) where kind = 'dm';
create index if not exists chat_threads_a_idx on public.chat_threads (member_a, last_at desc);
create index if not exists chat_threads_b_idx on public.chat_threads (member_b, last_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  from_id uuid not null references auth.users (id) on delete cascade,
  from_name text not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_idx on public.chat_messages (thread_id, created_at);

create table if not exists public.games (
  id text primary key,
  kind text not null check (kind in ('chess', 'quiz', 'math', 'word')),
  code text not null,
  host_id uuid not null references auth.users (id) on delete cascade,
  host_name text not null,
  guest_id uuid references auth.users (id) on delete cascade,
  guest_name text,
  status text not null check (status in ('waiting', 'active', 'finished')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists games_status_idx on public.games (status, kind, created_at desc);
create index if not exists games_host_idx on public.games (host_id, updated_at desc);
create index if not exists games_guest_idx on public.games (guest_id, updated_at desc);
create index if not exists games_code_idx on public.games (code);

alter table public.social_profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.social_notifications enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.games enable row level security;

revoke all on public.social_profiles from anon, authenticated;
revoke all on public.friend_requests from anon, authenticated;
revoke all on public.friendships from anon, authenticated;
revoke all on public.social_notifications from anon, authenticated;
revoke all on public.chat_threads from anon, authenticated;
revoke all on public.chat_messages from anon, authenticated;
revoke all on public.games from anon, authenticated;

grant all on public.social_profiles to service_role;
grant all on public.friend_requests to service_role;
grant all on public.friendships to service_role;
grant all on public.social_notifications to service_role;
grant all on public.chat_threads to service_role;
grant all on public.chat_messages to service_role;
grant all on public.games to service_role;

-- Old finished games are useful for a week, then they can go.
create or replace function public.prune_finished_games()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.games where status = 'finished' and updated_at < now() - interval '7 days';
$$;

revoke all on function public.prune_finished_games() from anon, authenticated;
