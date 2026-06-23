-- Owner-managed chart of accounts.

revoke insert, update, delete on public.accounts from authenticated;

create or replace function public.save_account(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_tenant();
  v_user uuid := auth.uid();
  v_id uuid := nullif(p_payload->>'id', '')::uuid;
  v_code text := trim(p_payload->>'code');
  v_name text := trim(p_payload->>'name');
  v_category text := p_payload->>'category';
  v_normal_balance text;
  v_existing public.accounts%rowtype;
begin
  if not public.has_tenant_role(v_tenant, 'owner') then
    raise exception 'Hanya Owner yang dapat mengelola akun.';
  end if;
  if v_code is null or v_code !~ '^[A-Za-z0-9._-]{1,20}$' then
    raise exception 'Format kode akun tidak valid.';
  end if;
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'Nama akun wajib diisi dan maksimal 120 karakter.';
  end if;
  if v_category not in ('asset', 'liability', 'equity', 'revenue', 'expense') then
    raise exception 'Kategori akun tidak valid.';
  end if;
  v_normal_balance := case when v_category in ('asset', 'expense') then 'debit' else 'credit' end;

  if v_id is null then
    if exists (
      select 1 from public.accounts
      where tenant_id = v_tenant and lower(code) = lower(v_code)
    ) then
      raise exception 'Kode akun sudah digunakan.';
    end if;
    insert into public.accounts (tenant_id, code, name, category, normal_balance, active)
    values (v_tenant, v_code, v_name, v_category, v_normal_balance, true)
    returning id into v_id;
    insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
    values (
      v_tenant, v_user, 'create', 'account', v_id,
      jsonb_build_object('code', v_code, 'name', v_name, 'category', v_category)
    );
  else
    select * into v_existing from public.accounts
    where id = v_id and tenant_id = v_tenant
    for update;
    if not found then raise exception 'Akun tidak ditemukan.'; end if;
    if v_existing.system_key is not null then raise exception 'Akun sistem tidak dapat diubah.'; end if;
    if v_code <> v_existing.code then raise exception 'Kode akun tidak dapat diubah.'; end if;
    if v_category <> v_existing.category then raise exception 'Kategori akun tidak dapat diubah setelah akun dibuat.'; end if;
    update public.accounts set name = v_name where id = v_id;
    insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
    values (
      v_tenant, v_user, 'update', 'account', v_id,
      jsonb_build_object('code', v_existing.code, 'old_name', v_existing.name, 'new_name', v_name)
    );
  end if;
  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.set_account_active(p_account_id uuid, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_tenant();
  v_user uuid := auth.uid();
  v_account public.accounts%rowtype;
begin
  if not public.has_tenant_role(v_tenant, 'owner') then
    raise exception 'Hanya Owner yang dapat mengelola akun.';
  end if;
  select * into v_account from public.accounts
  where id = p_account_id and tenant_id = v_tenant
  for update;
  if not found then raise exception 'Akun tidak ditemukan.'; end if;
  if v_account.system_key is not null then raise exception 'Akun sistem tidak dapat dinonaktifkan.'; end if;
  update public.accounts set active = p_active where id = p_account_id;
  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  values (
    v_tenant, v_user,
    case when p_active then 'activate' else 'deactivate' end,
    'account', p_account_id,
    jsonb_build_object('code', v_account.code, 'name', v_account.name)
  );
  return jsonb_build_object('id', p_account_id, 'active', p_active);
end;
$$;

grant execute on function public.save_account(jsonb) to authenticated;
grant execute on function public.set_account_active(uuid, boolean) to authenticated;
