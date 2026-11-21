update public.households
   set name = lower(name);

alter table public.households
  add constraint households_name_lowercase_check check (name = lower(name));

create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
  normalized_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  normalized_name := lower(trim(coalesce(p_name, '')));
  if length(normalized_name) not between 1 and 80 then
    raise exception 'Household name must be between 1 and 80 characters';
  end if;

  insert into public.households (name, created_by)
  values (normalized_name, auth.uid())
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id)
  values (new_household_id, auth.uid());

  return new_household_id;
end;
$$;

create or replace function public.rename_household(
  p_household_id uuid,
  p_name text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_household_member(p_household_id) then
    raise exception 'Household membership required';
  end if;

  normalized_name := lower(trim(coalesce(p_name, '')));
  if length(normalized_name) not between 1 and 80 then
    raise exception 'Household name must be between 1 and 80 characters';
  end if;

  update public.households
     set name = normalized_name
   where id = p_household_id;

  return normalized_name;
end;
$$;

revoke all on function public.rename_household(uuid, text) from public;
grant execute on function public.rename_household(uuid, text) to authenticated;
