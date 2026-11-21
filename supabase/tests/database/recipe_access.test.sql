create extension if not exists pgtap with schema extensions;

begin;

select plan(7);

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

select lives_ok(
  $$
    insert into public.recipes (
      household_id, created_by, title, ingredients, method, source_url
    ) values
      (
        '10000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000001',
        'Household A Handwritten Soup',
        array['2 cups broth'],
        array['Simmer'],
        null
      ),
      (
        '10000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000001',
        'Household A Family Soup',
        array['3 cups broth'],
        array['Simmer'],
        null
      )
  $$,
  'multiple recipes can be saved without a source URL'
);
select throws_ok(
  $$
    insert into public.recipes (
      household_id, created_by, title, ingredients, method, source_url
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001',
      'Duplicate source',
      array['1 pie crust'],
      array['Bake'],
      'https://example.com/a-pie'
    )
  $$,
  '23505',
  null,
  'a source URL remains unique within a household'
);
select throws_ok(
  $$
    update public.recipes
       set source_url = 'https://example.com/handwritten-soup'
     where title = 'Household A Handwritten Soup'
  $$,
  'P0001',
  'A saved recipe cannot change its household, creator, or source',
  'a source-less recipe cannot gain a source after saving'
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
  3,
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
