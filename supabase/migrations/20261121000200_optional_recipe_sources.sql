alter table public.recipes
  alter column source_url drop not null;

create or replace function public.preserve_recipe_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.household_id <> old.household_id
     or new.created_by <> old.created_by
     or new.source_url is distinct from old.source_url then
    raise exception 'A saved recipe cannot change its household, creator, or source';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
