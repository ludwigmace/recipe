alter table public.recipes
  add column preparation_steps jsonb,
  add constraint recipes_preparation_steps_is_array
    check (
      preparation_steps is null
      or jsonb_typeof(preparation_steps) = 'array'
    );
