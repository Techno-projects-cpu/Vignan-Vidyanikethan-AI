-- Private debate payloads: browsers must use the authenticated application API.
create table if not exists public.debate_rooms (
  id uuid primary key,
  revision integer not null default 0,
  payload jsonb not null,
  expires_at timestamptz not null
);
create index if not exists debate_rooms_expiry on public.debate_rooms(expires_at);
alter table public.debate_rooms enable row level security;
revoke all on public.debate_rooms from anon, authenticated;
grant select, insert, update, delete on public.debate_rooms to service_role;
-- Expired rooms cannot be read through the app. Expired rows are purged on room
-- creation; operators may additionally schedule DELETE WHERE expires_at < now().
