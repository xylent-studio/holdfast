alter table public.list_items
  add column if not exists now_date date;

alter table public.lists
  add column if not exists scheduled_date date,
  add column if not exists scheduled_time time,
  add column if not exists completed_at timestamptz;

alter table public.daily_records
  add column if not exists focus_list_ids uuid[] default '{}';

update public.daily_records
set focus_list_ids = '{}'::uuid[]
where focus_list_ids is null;

alter table public.daily_records
  alter column focus_list_ids set default '{}',
  alter column focus_list_ids set not null;

create index if not exists lists_user_scheduled_date_idx
on public.lists (user_id, scheduled_date, server_updated_at);

update public.items
set schema_version = greatest(schema_version, 5)
where schema_version < 5;

update public.lists
set schema_version = greatest(schema_version, 5)
where schema_version < 5;

update public.list_items
set schema_version = greatest(schema_version, 5)
where schema_version < 5;

update public.daily_records
set schema_version = greatest(schema_version, 5)
where schema_version < 5;

update public.weekly_records
set schema_version = greatest(schema_version, 5)
where schema_version < 5;

update public.routines
set schema_version = greatest(schema_version, 5)
where schema_version < 5;

update public.settings
set schema_version = greatest(schema_version, 5)
where schema_version < 5;

update public.attachments
set schema_version = greatest(schema_version, 5)
where schema_version < 5;
