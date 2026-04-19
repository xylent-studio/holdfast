create schema if not exists holdfast_private;

create or replace function holdfast_private.touch_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.server_updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.routines (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  schema_version integer not null,
  title text not null,
  lane text not null check (lane in ('work', 'health', 'home', 'people', 'build', 'admin')),
  destination text not null check (destination in ('today', 'upcoming')),
  weekdays smallint[] not null default '{}',
  scheduled_time time,
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, id)
);

create table if not exists public.items (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  schema_version integer not null,
  title text not null,
  kind text not null check (kind in ('capture', 'task', 'note')),
  lane text not null check (lane in ('work', 'health', 'home', 'people', 'build', 'admin')),
  status text not null check (status in ('inbox', 'today', 'upcoming', 'waiting', 'done', 'archived')),
  body text not null default '',
  source_text text,
  source_item_id uuid,
  capture_mode text check (capture_mode in ('uncertain', 'direct', 'context')),
  source_date date not null,
  scheduled_date date,
  scheduled_time time,
  routine_id uuid,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, id),
  constraint items_routine_fk foreign key (user_id, routine_id) references public.routines (user_id, id) on delete set null
);

create table if not exists public.lists (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  schema_version integer not null,
  title text not null,
  kind text not null check (kind in ('replenishment', 'checklist', 'project', 'reference')),
  lane text not null check (lane in ('work', 'health', 'home', 'people', 'build', 'admin')),
  pinned boolean not null default false,
  source_item_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, id)
);

create table if not exists public.list_items (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  schema_version integer not null,
  list_id uuid not null,
  title text not null,
  body text not null default '',
  status text not null check (status in ('open', 'done', 'archived')),
  position integer not null default 0,
  source_item_id uuid,
  promoted_item_id uuid,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, id),
  constraint list_items_list_fk foreign key (user_id, list_id) references public.lists (user_id, id) on delete cascade
);

create table if not exists public.daily_records (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  schema_version integer not null,
  started_at timestamptz,
  closed_at timestamptz,
  readiness jsonb not null default '{}'::jsonb,
  focus_item_ids uuid[] not null default '{}',
  launch_note text not null default '',
  close_win text not null default '',
  close_carry text not null default '',
  close_seed text not null default '',
  close_note text not null default '',
  seeded_routine_ids uuid[] not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, date)
);

create table if not exists public.weekly_records (
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  schema_version integer not null,
  focus text not null default '',
  protect text not null default '',
  notes text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, week_start)
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  schema_version integer not null,
  direction text not null default '',
  standards text not null default '',
  why text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.attachments (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  schema_version integer not null,
  item_id uuid not null,
  kind text not null check (kind in ('image', 'audio', 'file')),
  name text not null,
  mime_type text not null,
  size bigint not null check (size >= 0),
  storage_path text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, id),
  constraint attachments_item_fk foreign key (user_id, item_id) references public.items (user_id, id) on delete cascade
);

create table if not exists public.deleted_records (
  user_id uuid not null references auth.users (id) on delete cascade,
  entity text not null check (entity in ('item', 'list', 'listItem', 'dailyRecord', 'weeklyRecord', 'routine', 'settings', 'attachment')),
  record_id text not null,
  deleted_at timestamptz not null,
  server_updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, entity, record_id)
);

create index if not exists items_user_server_updated_idx on public.items (user_id, server_updated_at);
create index if not exists lists_user_server_updated_idx on public.lists (user_id, server_updated_at);
create index if not exists list_items_user_server_updated_idx on public.list_items (user_id, server_updated_at);
create index if not exists daily_records_user_server_updated_idx on public.daily_records (user_id, server_updated_at);
create index if not exists weekly_records_user_server_updated_idx on public.weekly_records (user_id, server_updated_at);
create index if not exists routines_user_server_updated_idx on public.routines (user_id, server_updated_at);
create index if not exists settings_user_server_updated_idx on public.settings (user_id, server_updated_at);
create index if not exists attachments_user_server_updated_idx on public.attachments (user_id, server_updated_at);
create index if not exists attachments_user_item_idx on public.attachments (user_id, item_id);
create index if not exists deleted_records_user_server_updated_idx on public.deleted_records (user_id, server_updated_at);

drop trigger if exists items_touch_server_updated_at on public.items;
create trigger items_touch_server_updated_at
before update on public.items
for each row execute function holdfast_private.touch_server_updated_at();

drop trigger if exists lists_touch_server_updated_at on public.lists;
create trigger lists_touch_server_updated_at
before update on public.lists
for each row execute function holdfast_private.touch_server_updated_at();

drop trigger if exists list_items_touch_server_updated_at on public.list_items;
create trigger list_items_touch_server_updated_at
before update on public.list_items
for each row execute function holdfast_private.touch_server_updated_at();

drop trigger if exists daily_records_touch_server_updated_at on public.daily_records;
create trigger daily_records_touch_server_updated_at
before update on public.daily_records
for each row execute function holdfast_private.touch_server_updated_at();

drop trigger if exists weekly_records_touch_server_updated_at on public.weekly_records;
create trigger weekly_records_touch_server_updated_at
before update on public.weekly_records
for each row execute function holdfast_private.touch_server_updated_at();

drop trigger if exists routines_touch_server_updated_at on public.routines;
create trigger routines_touch_server_updated_at
before update on public.routines
for each row execute function holdfast_private.touch_server_updated_at();

drop trigger if exists settings_touch_server_updated_at on public.settings;
create trigger settings_touch_server_updated_at
before update on public.settings
for each row execute function holdfast_private.touch_server_updated_at();

drop trigger if exists attachments_touch_server_updated_at on public.attachments;
create trigger attachments_touch_server_updated_at
before update on public.attachments
for each row execute function holdfast_private.touch_server_updated_at();

drop trigger if exists deleted_records_touch_server_updated_at on public.deleted_records;
create trigger deleted_records_touch_server_updated_at
before update on public.deleted_records
for each row execute function holdfast_private.touch_server_updated_at();

alter table public.items enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.daily_records enable row level security;
alter table public.weekly_records enable row level security;
alter table public.routines enable row level security;
alter table public.settings enable row level security;
alter table public.attachments enable row level security;
alter table public.deleted_records enable row level security;

drop policy if exists "users own their items" on public.items;
create policy "users own their items"
on public.items
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users own their lists" on public.lists;
create policy "users own their lists"
on public.lists
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users own their list items" on public.list_items;
create policy "users own their list items"
on public.list_items
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users own their daily records" on public.daily_records;
create policy "users own their daily records"
on public.daily_records
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users own their weekly records" on public.weekly_records;
create policy "users own their weekly records"
on public.weekly_records
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users own their routines" on public.routines;
create policy "users own their routines"
on public.routines
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users own their settings" on public.settings;
create policy "users own their settings"
on public.settings
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users own their attachments" on public.attachments;
create policy "users own their attachments"
on public.attachments
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users own their tombstones" on public.deleted_records;
create policy "users own their tombstones"
on public.deleted_records
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('holdfast-attachments', 'holdfast-attachments', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "holdfast attachments read" on storage.objects;
create policy "holdfast attachments read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'holdfast-attachments'
  and owner_id = (select auth.uid()::text)
);

drop policy if exists "holdfast attachments insert" on storage.objects;
create policy "holdfast attachments insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'holdfast-attachments'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "holdfast attachments update" on storage.objects;
create policy "holdfast attachments update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'holdfast-attachments'
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'holdfast-attachments'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "holdfast attachments delete" on storage.objects;
create policy "holdfast attachments delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'holdfast-attachments'
  and owner_id = (select auth.uid()::text)
);
