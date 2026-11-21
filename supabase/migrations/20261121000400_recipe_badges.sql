alter table public.households
  add column available_badges text[] not null default array[
    'breakfast',
    'brunch',
    'lunch',
    'dinner',
    'soup',
    'salad',
    'appetizer',
    'side dish',
    'dessert',
    'snack',
    'vegetarian',
    'vegan',
    'quick & easy',
    'thanksgiving',
    'holiday'
  ]::text[];

alter table public.recipes
  add column badges text[] not null default array[]::text[];

create or replace function public.update_household_badges(
  p_household_id uuid,
  p_badges text[]
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_badges text[];
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'Household membership required';
  end if;

  if coalesce(cardinality(p_badges), 0) > 40 then
    raise exception 'A household can have at most 40 badges';
  end if;

  if exists (
    select 1
      from unnest(coalesce(p_badges, array[]::text[])) as input_badges(badge)
     where badge is null
        or length(trim(badge)) not between 1 and 32
  ) then
    raise exception 'Badge names must be between 1 and 32 characters';
  end if;

  select coalesce(array_agg(normalized order by normalized), array[]::text[])
    into normalized_badges
    from (
      select distinct lower(trim(badge)) as normalized
        from unnest(coalesce(p_badges, array[]::text[])) as input_badges(badge)
    ) as unique_badges;

  update public.households
     set available_badges = normalized_badges
   where id = p_household_id;

  return normalized_badges;
end;
$$;

revoke all on function public.update_household_badges(uuid, text[]) from public;
grant execute on function public.update_household_badges(uuid, text[]) to authenticated;
