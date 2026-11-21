create extension if not exists pgtap with schema extensions;

begin;

select plan(4);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
) values
  (
    '00000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'member-a@example.test',
    '',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'member-b@example.test',
    '',
    now(),
    now(),
    now()
  );

insert into public.households (id, name, created_by) values
  (
    '10000000-0000-4000-8000-000000000001',
    'Household A',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Household B',
    '00000000-0000-4000-8000-000000000002'
  );

insert into public.household_members (household_id, user_id) values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002'
  );

insert into public.recipes (
  household_id, created_by, title, ingredients, method, source_url
) values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'Household A Pie',
    array['1 pie crust'],
    array['Bake'],
    'https://example.com/a-pie'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    'Household B Pie',
    array['1 pie crust'],
    array['Bake'],
    'https://example.com/b-pie'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select is(
  (select count(*)::integer from public.recipes),
  1,
  'a household member sees only their household recipe'
);
select is(
  (select count(*)::integer from public.households),
  1,
  'a household member sees only their household'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.recipes),
  1,
  'another household member sees only their own recipe'
);
select is(
  (select count(*)::integer from public.households),
  1,
  'another household member sees only their own household'
);

select * from finish();
rollback;
