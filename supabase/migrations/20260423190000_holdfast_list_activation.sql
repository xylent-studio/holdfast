alter table public.lists
  add column if not exists scheduled_date date,
  add column if not exists scheduled_time time,
  add column if not exists completed_at timestamptz;

alter table public.daily_records
  add column if not exists focus_list_ids uuid[] not null default '{}';

create index if not exists lists_user_scheduled_date_idx
on public.lists (user_id, scheduled_date, server_updated_at);
