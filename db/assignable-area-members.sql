-- Allow pre-registered area members to receive assignments before signup.
-- No auth account, password, confirmation, or email is created here.
begin;
alter table public.profiles add column auth_user_id uuid;
update public.profiles set auth_user_id = id;
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles add constraint profiles_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete cascade;
alter table public.profiles add constraint profiles_auth_identity_check
  check (auth_user_id is null or auth_user_id = id);
create unique index profiles_auth_user_id_key on public.profiles(auth_user_id);
create unique index profiles_email_normalized_key on public.profiles(lower(email));

-- Existing assignments and historical references follow the identity at signup.
do $$
declare c record;
begin
  for c in select conrelid::regclass as tbl, conname, pg_get_constraintdef(oid) as def
    from pg_constraint where contype = 'f' and confrelid = 'public.profiles'::regclass
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
    execute format('alter table %s add constraint %I %s ON UPDATE CASCADE',
      c.tbl, c.conname, c.def);
  end loop;
end $$;

create policy profiles_insert_pending on public.profiles
  for insert to authenticated
  with check (private.is_super_admin() and auth_user_id is null and platform_role = 'member');
grant insert on public.profiles to authenticated;

create or replace function private.protect_profile_security_fields()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin') then
    if new.id is distinct from old.id or new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'O vínculo da conta só pode ser alterado pelo serviço de autenticação';
    end if;
    if not private.is_super_admin() then
      if new.platform_role is distinct from old.platform_role then
        raise exception 'O perfil de acesso só pode ser alterado por um Administrador';
      end if;
      if new.email is distinct from old.email then
        raise exception 'O e-mail de acesso não pode ser alterado por este formulário';
      end if;
    end if;
  end if;
  return new;
end $$;

-- Invoker triggers retain existing RLS and administrator authorization.
create or replace function private.prepare_assignable_area_member()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  select id into new.user_id from public.profiles where lower(email) = new.email;
  if new.user_id is null then
    insert into public.profiles(id, email, full_name, phone, platform_role)
    values(gen_random_uuid(), new.email, new.full_name, new.phone, 'member')
    on conflict (lower(email)) do update set full_name = excluded.full_name, phone = excluded.phone
    returning id into new.user_id;
  end if;
  return new;
end $$;
revoke all on function private.prepare_assignable_area_member() from public, anon, authenticated;
create trigger area_accesses_prepare_assignable_member
  before insert or update of email, full_name, phone on public.area_accesses
  for each row execute function private.prepare_assignable_area_member();

create or replace function private.sync_assignable_area_member()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if new.user_id is not null then
    insert into public.group_members(group_id, user_id, role)
    values(new.area_id, new.user_id,
      case when new.access_role in ('administrator','manager') then 'admin' else 'member' end)
    on conflict(group_id,user_id) do update set role = excluded.role;
    update public.profiles set full_name = new.full_name, phone = new.phone, updated_at = now()
    where id = new.user_id;
  end if;
  return new;
end $$;
revoke all on function private.sync_assignable_area_member() from public, anon, authenticated;
create trigger area_accesses_sync_assignable_member
  after insert or update of email, full_name, phone, access_role, area_id on public.area_accesses
  for each row execute function private.sync_assignable_area_member();

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  invited_name text;
  invited_phone text;
begin
  -- Preserve assignments when a pre-registered person creates their account.
  update public.profiles
  set id = new.id, auth_user_id = new.id, updated_at = now()
  where lower(email) = lower(new.email) and auth_user_id is null;

  select aa.full_name, aa.phone
  into invited_name, invited_phone
  from public.area_accesses aa
  where aa.email = lower(new.email)
  order by aa.created_at
  limit 1;

  insert into public.profiles(id, auth_user_id, email, full_name, phone, platform_role)
  values(
    new.id,
    new.id,
    lower(new.email),
    coalesce(invited_name, new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce(invited_phone, new.raw_user_meta_data->>'phone'),
    case
      when lower(new.email) = 'lais_pedrosoo@hotmail.com' then 'super_admin'
      when exists (
        select 1 from public.area_accesses aa
        where aa.email = lower(new.email)
          and aa.access_role = 'administrator'
      ) then 'super_admin'
      else 'member'
    end
  )
  on conflict(id) do update set
    auth_user_id = excluded.auth_user_id,
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone,
    platform_role = excluded.platform_role,
    updated_at = now();

  update public.area_accesses
  set user_id = new.id,
      updated_at = now()
  where email = lower(new.email);

  insert into public.group_members(group_id, user_id, role)
  select
    aa.area_id,
    new.id,
    case when aa.access_role in ('administrator','manager') then 'admin' else 'member' end
  from public.area_accesses aa
  where aa.user_id = new.id
  on conflict (group_id, user_id)
  do update set role = excluded.role;

  return new;
end;
$function$;

-- Signup is only invoked by the existing auth trigger, never a client RPC.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Include people already registered in Settings.
update public.area_accesses set full_name = full_name where user_id is null;
notify pgrst, 'reload schema';
commit;
