create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  token_hash text not null unique,
  invited_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete restrict,
  title text not null check (length(trim(title)) between 1 and 200),
  ingredients text[] not null check (cardinality(ingredients) > 0),
  method text[] not null check (cardinality(method) > 0),
  source_url text not null check (source_url ~ '^https?://'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, source_url)
);

create index recipes_household_title_active_idx
  on public.recipes (household_id, lower(title))
  where archived_at is null;

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members as member
    where member.household_id = p_household_id
      and member.user_id = auth.uid()
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Household name must be between 1 and 80 characters';
  end if;

  insert into public.households (name, created_by)
  values (trim(p_name), auth.uid())
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id)
  values (new_household_id, auth.uid());

  return new_household_id;
end;
$$;

revoke all on function public.create_household(text) from public;
grant execute on function public.create_household(text) to authenticated;

create or replace function public.create_household_invite(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_token text;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'Household membership required';
  end if;

  invite_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.household_invitations (household_id, token_hash, invited_by)
  values (
    p_household_id,
    encode(extensions.digest(invite_token, 'sha256'), 'hex'),
    auth.uid()
  );

  return invite_token;
end;
$$;

revoke all on function public.create_household_invite(uuid) from public;
grant execute on function public.create_household_invite(uuid) to authenticated;

create or replace function public.accept_household_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.household_invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
    into invite
    from public.household_invitations
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and accepted_at is null
     and expires_at > now()
   for update;

  if not found then
    raise exception 'Invitation is invalid, expired, or already used';
  end if;

  insert into public.household_members (household_id, user_id)
  values (invite.household_id, auth.uid())
  on conflict do nothing;

  update public.household_invitations
     set accepted_by = auth.uid(), accepted_at = now()
   where id = invite.id;

  return invite.household_id;
end;
$$;

revoke all on function public.accept_household_invite(text) from public;
grant execute on function public.accept_household_invite(text) to authenticated;

create or replace function public.preserve_recipe_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.household_id <> old.household_id
     or new.created_by <> old.created_by
     or new.source_url <> old.source_url then
    raise exception 'A saved recipe cannot change its household, creator, or source';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger preserve_recipe_source
before update on public.recipes
for each row execute function public.preserve_recipe_source();

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;
alter table public.recipes enable row level security;

create policy "Household members can read their households"
  on public.households for select to authenticated
  using (public.is_household_member(id));

create policy "Members can read household membership"
  on public.household_members for select to authenticated
  using (public.is_household_member(household_id));

create policy "Members can read household recipes"
  on public.recipes for select to authenticated
  using (public.is_household_member(household_id));

create policy "Members can add household recipes"
  on public.recipes for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and created_by = auth.uid()
  );

create policy "Members can edit household recipes"
  on public.recipes for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

grant select on public.households, public.household_members to authenticated;
grant select, insert, update on public.recipes to authenticated;
