-- Delete unused accounts or merge used accounts into another active account.

create or replace function public.delete_account(
  p_account_id uuid,
  p_target_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_tenant();
  v_user uuid := auth.uid();
  v_source public.accounts%rowtype;
  v_target public.accounts%rowtype;
  v_journal_count integer;
  v_payment_count integer;
begin
  if not public.has_tenant_role(v_tenant, 'owner') then
    raise exception 'Hanya Owner yang dapat menghapus akun.';
  end if;

  select * into v_source
  from public.accounts
  where id = p_account_id and tenant_id = v_tenant
  for update;

  if not found then raise exception 'Akun tidak ditemukan.'; end if;
  if v_source.system_key is not null then raise exception 'Akun sistem tidak dapat dihapus.'; end if;

  select count(*) into v_journal_count
  from public.journal_lines
  where tenant_id = v_tenant and account_id = p_account_id;

  select count(*) into v_payment_count
  from public.payments
  where tenant_id = v_tenant and account_id = p_account_id;

  if v_journal_count + v_payment_count > 0 then
    if p_target_account_id is null then
      raise exception 'Akun sudah memiliki riwayat. Pilih akun tujuan pengalihan.';
    end if;
    if p_target_account_id = p_account_id then
      raise exception 'Akun tujuan tidak boleh sama dengan akun asal.';
    end if;

    select * into v_target
    from public.accounts
    where id = p_target_account_id and tenant_id = v_tenant
    for update;

    if not found then raise exception 'Akun tujuan tidak ditemukan.'; end if;
    if not v_target.active then raise exception 'Akun tujuan harus aktif.'; end if;
    if v_target.category <> v_source.category then
      raise exception 'Akun tujuan harus memiliki kategori yang sama.';
    end if;

    update public.journal_lines
    set account_id = p_target_account_id
    where tenant_id = v_tenant and account_id = p_account_id;

    update public.payments
    set account_id = p_target_account_id
    where tenant_id = v_tenant and account_id = p_account_id;
  elsif p_target_account_id is not null then
    raise exception 'Akun yang belum dipakai tidak memerlukan akun tujuan.';
  end if;

  delete from public.accounts
  where id = p_account_id and tenant_id = v_tenant;

  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  values (
    v_tenant,
    v_user,
    case when p_target_account_id is null then 'delete' else 'merge_delete' end,
    'account',
    p_account_id,
    jsonb_build_object(
      'source_code', v_source.code,
      'source_name', v_source.name,
      'source_category', v_source.category,
      'target_account_id', p_target_account_id,
      'target_code', v_target.code,
      'target_name', v_target.name,
      'journal_lines_moved', v_journal_count,
      'payments_moved', v_payment_count
    )
  );

  return jsonb_build_object(
    'id', p_account_id,
    'target_account_id', p_target_account_id,
    'journal_lines_moved', v_journal_count,
    'payments_moved', v_payment_count
  );
end;
$$;

revoke all on function public.delete_account(uuid, uuid) from public;
grant execute on function public.delete_account(uuid, uuid) to authenticated;
