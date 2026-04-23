alter table public.list_items
add column if not exists now_date date;

update public.list_items as list_item
set
  title = case
    when item.updated_at > list_item.updated_at then item.title
    else list_item.title
  end,
  body = case
    when item.updated_at > list_item.updated_at then item.body
    else list_item.body
  end,
  status = case
    when item.updated_at > list_item.updated_at and item.status = 'done' then 'done'
    else list_item.status
  end,
  completed_at = case
    when item.updated_at > list_item.updated_at and item.status = 'done' then coalesce(item.completed_at, list_item.completed_at)
    when item.status = 'today' then null
    else list_item.completed_at
  end,
  now_date = case
    when item.status = 'today' then coalesce(item.scheduled_date, item.source_date)
    else list_item.now_date
  end,
  updated_at = greatest(list_item.updated_at, item.updated_at),
  schema_version = greatest(list_item.schema_version, 4)
from public.items as item
where list_item.promoted_item_id = item.id
  and list_item.user_id = item.user_id;

update public.items as item
set
  status = 'archived',
  archived_at = coalesce(item.archived_at, timezone('utc', now())),
  updated_at = timezone('utc', now()),
  schema_version = greatest(item.schema_version, 4)
where exists (
  select 1
  from public.list_items as list_item
  where list_item.promoted_item_id = item.id
    and list_item.user_id = item.user_id
)
  and item.deleted_at is null
  and item.status <> 'archived';
