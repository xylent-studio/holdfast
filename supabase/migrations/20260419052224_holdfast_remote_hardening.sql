create or replace function holdfast_private.touch_server_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.server_updated_at = timezone('utc', now());
  return new;
end;
$$;

create index if not exists items_user_routine_idx
on public.items (user_id, routine_id)
where routine_id is not null;

create index if not exists list_items_user_list_idx
on public.list_items (user_id, list_id);
