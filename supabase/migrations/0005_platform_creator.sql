-- Single platform Creator, one-company memberships, and managed company provisioning.

create table public.platform_creator (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.platform_creator enable row level security;

insert into public.platform_creator (singleton, user_id, email)
values (
  true,
  '6e473aa3-c262-449b-960b-93e09a4c88d6',
  'lpkp.mentari@gmail.com'
);

create unique index memberships_single_company_user_idx
  on public.memberships (user_id);

create unique index memberships_single_company_email_idx
  on public.memberships (lower(email));

create unique index memberships_single_active_owner_idx
  on public.memberships (tenant_id)
  where role = 'owner' and active;

create or replace function public.is_platform_creator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_creator
    where singleton and user_id = auth.uid()
  );
$$;

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
      and m.active
      and t.active
  );
$$;

create or replace function public.has_tenant_role(p_tenant_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
      and m.active
      and t.active
      and (m.role = p_role or m.role = 'owner')
  );
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.tenant_id
  from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  where m.user_id = auth.uid() and m.active and t.active
  order by m.created_at
  limit 1;
$$;

create or replace function public.get_current_profile()
returns table (
  tenant_id uuid,
  tenant_name text,
  tenant_active boolean,
  full_name text,
  role text,
  is_platform_creator boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.tenant_id,
    t.name,
    t.active,
    m.full_name,
    m.role,
    public.is_platform_creator()
  from public.memberships m
  join public.tenants t on t.id = m.tenant_id
  where m.user_id = auth.uid() and m.active
  limit 1;
$$;

create or replace function public.list_platform_companies()
returns table (
  id uuid,
  name text,
  email text,
  active boolean,
  created_at timestamptz,
  owner_name text,
  owner_email text,
  owner_active boolean,
  cashier_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_creator() then
    raise exception 'Hanya Creator yang dapat membuka daftar perusahaan.';
  end if;

  return query
  select
    t.id,
    t.name,
    t.email,
    t.active,
    t.created_at,
    owner.full_name,
    owner.email,
    coalesce(owner.active, false),
    count(cashier.id) filter (where cashier.active)
  from public.tenants t
  left join public.memberships owner
    on owner.tenant_id = t.id and owner.role = 'owner' and owner.active
  left join public.memberships cashier
    on cashier.tenant_id = t.id and cashier.role = 'cashier'
  group by t.id, owner.id
  order by t.created_at desc;
end;
$$;

create or replace function public.provision_company(
  p_name text,
  p_email text,
  p_owner_user_id uuid,
  p_owner_name text,
  p_owner_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_name text := trim(p_name);
  v_email text := lower(trim(p_email));
  v_owner_name text := trim(p_owner_name);
  v_owner_email text := lower(trim(p_owner_email));
  v_slug text;
begin
  if not public.is_platform_creator() then
    raise exception 'Hanya Creator yang dapat membuat perusahaan.';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'Nama perusahaan tidak valid.';
  end if;
  if char_length(v_owner_name) not between 2 and 120 then
    raise exception 'Nama Owner tidak valid.';
  end if;
  if v_owner_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email Owner tidak valid.';
  end if;
  if exists (
    select 1 from public.memberships
    where user_id = p_owner_user_id or lower(email) = v_owner_email
  ) then
    raise exception 'Akun Owner sudah terhubung ke perusahaan lain.';
  end if;

  v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if char_length(v_slug) < 2 then v_slug := 'company'; end if;
  v_slug := left(v_slug, 48) || '-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into public.tenants (name, slug, email)
  values (v_name, v_slug, nullif(v_email, ''))
  returning id into v_tenant;

  insert into public.memberships (tenant_id, user_id, full_name, email, role, active)
  values (v_tenant, p_owner_user_id, v_owner_name, v_owner_email, 'owner', true);

  insert into public.accounts (tenant_id, code, name, category, normal_balance, system_key)
  values
    (v_tenant, '1000', 'Kas & Bank', 'asset', 'debit', 'cash'),
    (v_tenant, '1100', 'Piutang Usaha', 'asset', 'debit', 'receivables'),
    (v_tenant, '1150', 'Persediaan Barang', 'asset', 'debit', 'inventory'),
    (v_tenant, '2000', 'Utang Usaha', 'liability', 'credit', 'payables'),
    (v_tenant, '3000', 'Modal Pemilik', 'equity', 'credit', 'capital'),
    (v_tenant, '4000', 'Pendapatan Penjualan', 'revenue', 'credit', 'sales_revenue'),
    (v_tenant, '5050', 'Harga Pokok Penjualan', 'expense', 'debit', 'cogs'),
    (v_tenant, '5100', 'Beban Sewa', 'expense', 'debit', null),
    (v_tenant, '5200', 'Beban Listrik & Internet', 'expense', 'debit', null),
    (v_tenant, '5300', 'Beban Operasional Lainnya', 'expense', 'debit', null);

  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  values (
    v_tenant,
    auth.uid(),
    'provision',
    'tenant',
    v_tenant,
    jsonb_build_object('owner_email', v_owner_email, 'owner_name', v_owner_name)
  );

  return v_tenant;
end;
$$;

create or replace function public.set_company_active(p_tenant_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_creator() then
    raise exception 'Hanya Creator yang dapat mengubah status perusahaan.';
  end if;
  if p_tenant_id = public.current_tenant_id() and not p_active then
    raise exception 'Perusahaan milik Creator tidak dapat dinonaktifkan dari panel ini.';
  end if;

  update public.tenants
  set active = p_active
  where id = p_tenant_id;

  if not found then raise exception 'Perusahaan tidak ditemukan.'; end if;
end;
$$;

create or replace function public.replace_company_owner(
  p_tenant_id uuid,
  p_owner_user_id uuid,
  p_owner_name text,
  p_owner_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_name text := trim(p_owner_name);
  v_owner_email text := lower(trim(p_owner_email));
begin
  if not public.is_platform_creator() then
    raise exception 'Hanya Creator yang dapat mengganti Owner.';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception 'Perusahaan tidak ditemukan.';
  end if;
  if exists (
    select 1 from public.memberships
    where user_id = p_owner_user_id or lower(email) = v_owner_email
  ) then
    raise exception 'Akun Owner sudah terhubung ke perusahaan lain.';
  end if;

  update public.memberships
  set active = false
  where tenant_id = p_tenant_id and role = 'owner' and active;

  insert into public.memberships (tenant_id, user_id, full_name, email, role, active)
  values (p_tenant_id, p_owner_user_id, v_owner_name, v_owner_email, 'owner', true);
end;
$$;

create or replace function public.set_cashier_active(p_membership_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_tenant();
begin
  if not public.has_tenant_role(v_tenant, 'owner') then
    raise exception 'Hanya Owner yang dapat mengelola Kasir.';
  end if;

  update public.memberships
  set active = p_active
  where id = p_membership_id
    and tenant_id = v_tenant
    and role = 'cashier';

  if not found then raise exception 'Akun Kasir tidak ditemukan.'; end if;
end;
$$;

revoke insert, update, delete on public.memberships from authenticated;
revoke all on table public.platform_creator from anon, authenticated;
revoke all on function public.is_platform_creator() from public;
revoke all on function public.get_current_profile() from public;
revoke all on function public.list_platform_companies() from public;
revoke all on function public.provision_company(text, text, uuid, text, text) from public;
revoke all on function public.set_company_active(uuid, boolean) from public;
revoke all on function public.replace_company_owner(uuid, uuid, text, text) from public;
revoke all on function public.set_cashier_active(uuid, boolean) from public;

grant execute on function public.is_platform_creator() to authenticated;
grant execute on function public.get_current_profile() to authenticated;
grant execute on function public.list_platform_companies() to authenticated;
grant execute on function public.provision_company(text, text, uuid, text, text) to authenticated;
grant execute on function public.set_company_active(uuid, boolean) to authenticated;
grant execute on function public.replace_company_owner(uuid, uuid, text, text) to authenticated;
grant execute on function public.set_cashier_active(uuid, boolean) to authenticated;
