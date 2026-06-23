-- CompAcc Modern Cloud Accounting
-- PostgreSQL schema, tenant isolation, audit trail, and atomic accounting RPCs.

create extension if not exists pgcrypto;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  email text,
  phone text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null check (email = lower(trim(email)) and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role text not null check (role in ('owner', 'cashier')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (tenant_id, email)
);

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type text not null check (type in ('customer', 'vendor', 'both')),
  name text not null,
  phone text,
  email text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null check (category in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  normal_balance text not null check (normal_balance in ('debit', 'credit')),
  system_key text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, code),
  unique (tenant_id, system_key)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sku text not null,
  name text not null,
  category text not null default 'Umum',
  purchase_price numeric(18,2) not null default 0 check (purchase_price >= 0),
  selling_price numeric(18,2) not null default 0 check (selling_price >= 0),
  stock numeric(18,3) not null default 0 check (stock >= 0),
  minimum_stock numeric(18,3) not null default 0 check (minimum_stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

create table public.document_sequences (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  prefix text not null,
  year integer not null,
  last_value bigint not null default 0,
  primary key (tenant_id, prefix, year)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('sale', 'purchase', 'expense', 'payment', 'manual', 'void')),
  payment_mode text not null default 'cash' check (payment_mode in ('cash', 'credit')),
  number text not null,
  date date not null,
  due_date date,
  party_id uuid references public.parties(id),
  party_name text,
  description text not null,
  total numeric(18,2) not null default 0 check (total >= 0),
  paid_amount numeric(18,2) not null default 0 check (paid_amount >= 0),
  remaining_amount numeric(18,2) not null default 0 check (remaining_amount >= 0),
  status text not null default 'posted' check (status in ('posted', 'voided')),
  invoice_status text check (invoice_status in ('unpaid', 'partial', 'paid', 'overdue')),
  voids_transaction_id uuid references public.transactions(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, client_request_id),
  unique (tenant_id, number)
);

create table public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  product_id uuid not null references public.products(id),
  sku text not null,
  name text not null,
  quantity numeric(18,3) not null check (quantity > 0),
  unit_price numeric(18,2) not null check (unit_price >= 0),
  unit_cost numeric(18,2) not null check (unit_cost >= 0),
  subtotal numeric(18,2) not null check (subtotal >= 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id),
  date date not null,
  amount numeric(18,2) not null check (amount > 0),
  account_id uuid not null references public.accounts(id),
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, client_request_id)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  transaction_id uuid references public.transactions(id),
  number text not null,
  date date not null,
  description text not null,
  source text not null check (source in ('sale', 'purchase', 'expense', 'payment', 'manual', 'void')),
  status text not null default 'posted' check (status in ('posted', 'reversed')),
  reverses_entry_id uuid references public.journal_entries(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, number)
);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  debit numeric(18,2) not null default 0 check (debit >= 0),
  credit numeric(18,2) not null default 0 check (credit >= 0),
  memo text,
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id),
  product_id uuid not null references public.products(id),
  movement_type text not null check (movement_type in ('sale', 'purchase', 'void_sale', 'void_purchase', 'adjustment')),
  quantity numeric(18,3) not null,
  unit_cost numeric(18,2) not null default 0,
  stock_before numeric(18,3) not null,
  stock_after numeric(18,3) not null,
  created_at timestamptz not null default now()
);

create table public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_id uuid not null,
  type text not null,
  message text not null,
  payload jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text,
  unique (tenant_id, job_id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index memberships_user_idx on public.memberships(user_id) where active;
create index products_tenant_name_idx on public.products(tenant_id, name);
create index transactions_tenant_date_idx on public.transactions(tenant_id, date desc);
create index transactions_open_invoice_idx on public.transactions(tenant_id, due_date) where remaining_amount > 0 and status = 'posted';
create index journal_entries_tenant_date_idx on public.journal_entries(tenant_id, date desc);
create index journal_lines_account_idx on public.journal_lines(tenant_id, account_id);
create index stock_movements_product_idx on public.stock_movements(tenant_id, product_id, created_at desc);
create index audit_logs_tenant_created_idx on public.audit_logs(tenant_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_updated_at before update on public.tenants
for each row execute function public.set_updated_at();
create trigger parties_updated_at before update on public.parties
for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products
for each row execute function public.set_updated_at();

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where tenant_id = p_tenant_id and user_id = auth.uid() and active
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
    select 1 from public.memberships
    where tenant_id = p_tenant_id and user_id = auth.uid() and active
      and (role = p_role or role = 'owner')
  );
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.memberships
  where user_id = auth.uid() and active
  order by created_at limit 1;
$$;

create or replace function public.require_tenant()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  v_tenant := public.current_tenant_id();
  if v_tenant is null then raise exception 'Pengguna tidak memiliki tenant aktif.'; end if;
  return v_tenant;
end;
$$;

create or replace function public.system_account(p_tenant uuid, p_key text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_account uuid;
begin
  select id into v_account from public.accounts
  where tenant_id = p_tenant and system_key = p_key and active;
  if v_account is null then raise exception 'Akun sistem % belum tersedia.', p_key; end if;
  return v_account;
end;
$$;

alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.parties enable row level security;
alter table public.accounts enable row level security;
alter table public.products enable row level security;
alter table public.document_sequences enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.payments enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.stock_movements enable row level security;
alter table public.sync_conflicts enable row level security;
alter table public.audit_logs enable row level security;

create policy tenant_read on public.tenants for select using (public.is_tenant_member(id));
create policy tenant_owner_update on public.tenants for update using (public.has_tenant_role(id, 'owner'));
create policy memberships_read on public.memberships for select using (public.is_tenant_member(tenant_id));
create policy memberships_owner_write on public.memberships for all using (public.has_tenant_role(tenant_id, 'owner')) with check (public.has_tenant_role(tenant_id, 'owner'));
create policy parties_read on public.parties for select using (public.is_tenant_member(tenant_id));
create policy parties_write on public.parties for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy accounts_read on public.accounts for select using (public.is_tenant_member(tenant_id));
create policy accounts_owner_write on public.accounts for all using (public.has_tenant_role(tenant_id, 'owner')) with check (public.has_tenant_role(tenant_id, 'owner'));
create policy products_read on public.products for select using (public.is_tenant_member(tenant_id));
create policy products_owner_write on public.products for all using (public.has_tenant_role(tenant_id, 'owner')) with check (public.has_tenant_role(tenant_id, 'owner'));
create policy transactions_read on public.transactions for select using (
  public.has_tenant_role(tenant_id, 'owner') or created_by = auth.uid()
);
create policy transaction_items_read on public.transaction_items for select using (
  exists (
    select 1 from public.transactions t
    where t.id = transaction_items.transaction_id and t.tenant_id = transaction_items.tenant_id
      and (public.has_tenant_role(t.tenant_id, 'owner') or t.created_by = auth.uid())
  )
);
create policy payments_read on public.payments for select using (
  public.has_tenant_role(tenant_id, 'owner') or created_by = auth.uid()
);
create policy journal_entries_owner_read on public.journal_entries for select using (public.has_tenant_role(tenant_id, 'owner'));
create policy journal_lines_owner_read on public.journal_lines for select using (public.has_tenant_role(tenant_id, 'owner'));
create policy stock_movements_read on public.stock_movements for select using (public.is_tenant_member(tenant_id));
create policy conflicts_read on public.sync_conflicts for select using (public.has_tenant_role(tenant_id, 'owner'));
create policy conflicts_owner_update on public.sync_conflicts for update using (public.has_tenant_role(tenant_id, 'owner'));
create policy audit_owner_read on public.audit_logs for select using (public.has_tenant_role(tenant_id, 'owner'));

create or replace function public.next_document_number(p_tenant uuid, p_prefix text)
returns text
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.document_sequences (tenant_id, prefix, year, last_value)
  values (p_tenant, p_prefix, extract(year from current_date)::integer, 1)
  on conflict (tenant_id, prefix, year)
  do update set last_value = public.document_sequences.last_value + 1
  returning p_prefix || '-' || year::text || '-' || lpad(last_value::text, 6, '0');
$$;

create or replace function public.account_balance(p_tenant uuid, p_account uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case when a.normal_balance = 'debit'
      then jl.debit - jl.credit
      else jl.credit - jl.debit
    end
  ), 0)
  from public.accounts a
  join public.journal_lines jl on jl.account_id = a.id
  join public.journal_entries je on je.id = jl.journal_entry_id and je.status = 'posted'
  where a.id = p_account and a.tenant_id = p_tenant;
$$;

create or replace function public.list_products()
returns table (
  id uuid,
  tenant_id uuid,
  sku text,
  name text,
  category text,
  purchase_price numeric,
  selling_price numeric,
  stock numeric,
  minimum_stock numeric,
  active boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.tenant_id,
    p.sku,
    p.name,
    p.category,
    case when public.has_tenant_role(p.tenant_id, 'owner') then p.purchase_price else 0 end,
    p.selling_price,
    p.stock,
    p.minimum_stock,
    p.active,
    p.updated_at
  from public.products p
  where p.tenant_id = public.require_tenant()
  order by p.name;
$$;

create or replace function public.list_accounts()
returns table (
  id uuid,
  tenant_id uuid,
  code text,
  name text,
  category text,
  normal_balance text,
  system_key text,
  active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.tenant_id, a.code, a.name, a.category, a.normal_balance, a.system_key, a.active
  from public.accounts a
  where a.tenant_id = public.require_tenant()
    and (
      public.has_tenant_role(a.tenant_id, 'owner')
      or a.system_key = 'cash'
      or (a.category = 'expense' and a.system_key is distinct from 'cogs')
    )
  order by a.code;
$$;

create or replace function public.assert_balanced_journal(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debit numeric;
  v_credit numeric;
begin
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
  into v_debit, v_credit
  from public.journal_lines where journal_entry_id = p_entry;
  if v_debit <= 0 or abs(v_debit - v_credit) > 0.005 then
    raise exception 'Jurnal tidak seimbang. Debit %, kredit %.', v_debit, v_credit;
  end if;
end;
$$;

create or replace function public.post_transaction(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_tenant();
  v_user uuid := auth.uid();
  v_request uuid := (p_payload->>'clientRequestId')::uuid;
  v_existing uuid;
  v_kind text := p_payload->>'kind';
  v_mode text := coalesce(p_payload->>'paymentMode', 'cash');
  v_date date := coalesce((p_payload->>'date')::date, current_date);
  v_due date := nullif(p_payload->>'dueDate', '')::date;
  v_party uuid := nullif(p_payload->>'partyId', '')::uuid;
  v_party_name text := nullif(p_payload->>'partyName', '');
  v_description text := coalesce(nullif(trim(p_payload->>'description'), ''), initcap(v_kind));
  v_total numeric := coalesce((p_payload->>'total')::numeric, 0);
  v_computed_total numeric := 0;
  v_total_cost numeric := 0;
  v_transaction uuid;
  v_entry uuid := gen_random_uuid();
  v_number text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty numeric;
  v_price numeric;
  v_cost numeric;
  v_new_stock numeric;
  v_new_cost numeric;
  v_cash uuid := public.system_account(v_tenant, 'cash');
  v_inventory uuid := public.system_account(v_tenant, 'inventory');
  v_revenue uuid := public.system_account(v_tenant, 'sales_revenue');
  v_cogs uuid := public.system_account(v_tenant, 'cogs');
  v_receivables uuid := public.system_account(v_tenant, 'receivables');
  v_payables uuid := public.system_account(v_tenant, 'payables');
  v_expense uuid;
  v_role text;
begin
  select role into v_role from public.memberships
  where tenant_id = v_tenant and user_id = v_user and active;
  if v_role = 'cashier' and v_kind <> 'sale' then
    raise exception 'Kasir hanya dapat memposting penjualan.';
  end if;
  select id into v_existing from public.transactions where tenant_id = v_tenant and client_request_id = v_request;
  if v_existing is not null then return jsonb_build_object('id', v_existing, 'duplicate', true); end if;
  if v_kind not in ('sale', 'purchase', 'expense') then raise exception 'Jenis transaksi tidak valid.'; end if;
  if v_mode not in ('cash', 'credit') then raise exception 'Mode pembayaran tidak valid.'; end if;
  if v_mode = 'credit' and (v_party is null or v_due is null) then
    raise exception 'Pihak dan jatuh tempo wajib untuk transaksi kredit.';
  end if;

  if v_kind in ('sale', 'purchase') then
    if jsonb_array_length(coalesce(p_payload->'items', '[]'::jsonb)) = 0 then raise exception 'Transaksi tidak memiliki item.'; end if;
    for v_item in select * from jsonb_array_elements(p_payload->'items')
    loop
      select * into v_product from public.products
      where id = (v_item->>'productId')::uuid and tenant_id = v_tenant and active
      for update;
      if not found then raise exception 'Produk tidak ditemukan.'; end if;
      v_qty := (v_item->>'quantity')::numeric;
      v_price := case
        when v_role = 'cashier' and v_kind = 'sale' then v_product.selling_price
        when v_role = 'cashier' and v_kind = 'purchase' then v_product.purchase_price
        else (v_item->>'unitPrice')::numeric
      end;
      if v_qty <= 0 or v_price < 0 then raise exception 'Qty atau harga tidak valid.'; end if;
      if v_kind = 'sale' and v_product.stock < v_qty then
        raise exception 'Stok % tidak cukup. Tersedia %, diminta %.', v_product.name, v_product.stock, v_qty;
      end if;
      v_computed_total := v_computed_total + (v_qty * v_price);
      if v_kind = 'sale' then v_total_cost := v_total_cost + (v_qty * v_product.purchase_price); end if;
    end loop;
    if abs(v_total - v_computed_total) > 0.01 then raise exception 'Total transaksi tidak sesuai rincian item.'; end if;
  elsif v_total <= 0 then
    raise exception 'Nominal beban harus lebih besar dari nol.';
  end if;
  if (v_kind = 'purchase' and v_mode = 'cash') or v_kind = 'expense' then
    if public.account_balance(v_tenant, v_cash) + 0.005 < v_total then
      raise exception 'Saldo Kas & Bank tidak mencukupi.';
    end if;
  end if;

  v_number := public.next_document_number(v_tenant, case v_kind when 'sale' then 'SAL' when 'purchase' then 'PUR' else 'EXP' end);
  insert into public.transactions (
    client_request_id, tenant_id, kind, payment_mode, number, date, due_date, party_id, party_name,
    description, total, paid_amount, remaining_amount, status, invoice_status, created_by
  ) values (
    v_request, v_tenant, v_kind, v_mode, v_number, v_date, v_due, v_party, v_party_name,
    v_description, v_total, case when v_mode = 'cash' then v_total else 0 end,
    case when v_mode = 'credit' then v_total else 0 end, 'posted',
    case when v_mode = 'credit' then 'unpaid' else 'paid' end, v_user
  ) returning id into v_transaction;

  if v_kind in ('sale', 'purchase') then
    for v_item in select * from jsonb_array_elements(p_payload->'items')
    loop
      select * into v_product from public.products
      where id = (v_item->>'productId')::uuid and tenant_id = v_tenant for update;
      v_qty := (v_item->>'quantity')::numeric;
      v_price := case
        when v_role = 'cashier' and v_kind = 'sale' then v_product.selling_price
        when v_role = 'cashier' and v_kind = 'purchase' then v_product.purchase_price
        else (v_item->>'unitPrice')::numeric
      end;
      v_cost := v_product.purchase_price;
      if v_kind = 'sale' then
        v_new_stock := v_product.stock - v_qty;
      else
        v_new_stock := v_product.stock + v_qty;
        v_new_cost := case when v_new_stock > 0
          then ((v_product.stock * v_product.purchase_price) + (v_qty * v_price)) / v_new_stock
          else v_price end;
      end if;
      insert into public.transaction_items (
        tenant_id, transaction_id, product_id, sku, name, quantity, unit_price, unit_cost, subtotal
      ) values (
        v_tenant, v_transaction, v_product.id, v_product.sku, v_product.name, v_qty, v_price,
        case when v_kind = 'sale' then v_cost else v_price end, v_qty * v_price
      );
      insert into public.stock_movements (
        tenant_id, transaction_id, product_id, movement_type, quantity, unit_cost, stock_before, stock_after
      ) values (
        v_tenant, v_transaction, v_product.id, v_kind, case when v_kind = 'sale' then -v_qty else v_qty end,
        case when v_kind = 'sale' then v_cost else v_price end, v_product.stock, v_new_stock
      );
      update public.products set
        stock = v_new_stock,
        purchase_price = case when v_kind = 'purchase' then v_new_cost else purchase_price end
      where id = v_product.id;
    end loop;
  end if;

  insert into public.journal_entries (
    id, tenant_id, transaction_id, number, date, description, source, created_by
  ) values (
    v_entry, v_tenant, v_transaction, 'JE-' || substring(v_number from 5), v_date, v_description, v_kind, v_user
  );

  if v_kind = 'sale' then
    insert into public.journal_lines (tenant_id, journal_entry_id, account_id, debit, credit) values
      (v_tenant, v_entry, case when v_mode = 'cash' then v_cash else v_receivables end, v_total, 0),
      (v_tenant, v_entry, v_revenue, 0, v_total),
      (v_tenant, v_entry, v_cogs, v_total_cost, 0),
      (v_tenant, v_entry, v_inventory, 0, v_total_cost);
  elsif v_kind = 'purchase' then
    insert into public.journal_lines (tenant_id, journal_entry_id, account_id, debit, credit) values
      (v_tenant, v_entry, v_inventory, v_total, 0),
      (v_tenant, v_entry, case when v_mode = 'cash' then v_cash else v_payables end, 0, v_total);
  else
    v_expense := (p_payload->>'expenseAccountId')::uuid;
    if not exists (
      select 1 from public.accounts where id = v_expense and tenant_id = v_tenant and category = 'expense' and system_key is distinct from 'cogs'
    ) then raise exception 'Akun beban tidak valid.'; end if;
    insert into public.journal_lines (tenant_id, journal_entry_id, account_id, debit, credit) values
      (v_tenant, v_entry, v_expense, v_total, 0),
      (v_tenant, v_entry, v_cash, 0, v_total);
  end if;
  perform public.assert_balanced_journal(v_entry);
  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  values (v_tenant, v_user, 'post', 'transaction', v_transaction, jsonb_build_object('number', v_number, 'kind', v_kind));
  return jsonb_build_object('id', v_transaction, 'number', v_number, 'duplicate', false);
end;
$$;

create or replace function public.settle_invoice(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_tenant();
  v_user uuid := auth.uid();
  v_request uuid := (p_payload->>'client_request_id')::uuid;
  v_tx public.transactions%rowtype;
  v_amount numeric := (p_payload->>'amount')::numeric;
  v_date date := coalesce((p_payload->>'date')::date, current_date);
  v_cash uuid := public.system_account(v_tenant, 'cash');
  v_counter uuid;
  v_payment uuid;
  v_entry uuid := gen_random_uuid();
  v_remaining numeric;
begin
  select * into v_tx from public.transactions
  where id = (p_payload->>'transaction_id')::uuid and tenant_id = v_tenant and status = 'posted'
  for update;
  if not found or v_tx.payment_mode <> 'credit' then raise exception 'Invoice kredit tidak ditemukan.'; end if;
  if v_amount <= 0 or v_amount > v_tx.remaining_amount then raise exception 'Nominal pembayaran tidak valid.'; end if;
  if v_tx.kind = 'purchase' and public.account_balance(v_tenant, v_cash) + 0.005 < v_amount then
    raise exception 'Saldo Kas & Bank tidak mencukupi.';
  end if;
  select id into v_payment from public.payments where tenant_id = v_tenant and client_request_id = v_request;
  if v_payment is not null then return jsonb_build_object('id', v_payment, 'duplicate', true); end if;
  v_counter := public.system_account(v_tenant, case when v_tx.kind = 'sale' then 'receivables' else 'payables' end);
  insert into public.payments (client_request_id, tenant_id, transaction_id, date, amount, account_id, note, created_by)
  values (v_request, v_tenant, v_tx.id, v_date, v_amount, v_cash, nullif(p_payload->>'note', ''), v_user)
  returning id into v_payment;
  v_remaining := v_tx.remaining_amount - v_amount;
  update public.transactions set
    paid_amount = paid_amount + v_amount,
    remaining_amount = v_remaining,
    invoice_status = case when v_remaining = 0 then 'paid' else 'partial' end
  where id = v_tx.id;
  insert into public.journal_entries (id, tenant_id, transaction_id, number, date, description, source, created_by)
  values (v_entry, v_tenant, v_tx.id, 'JE-PAY-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'), v_date,
    case when v_tx.kind = 'sale' then 'Penerimaan piutang ' else 'Pembayaran utang ' end || v_tx.number, 'payment', v_user);
  if v_tx.kind = 'sale' then
    insert into public.journal_lines (tenant_id, journal_entry_id, account_id, debit, credit) values
      (v_tenant, v_entry, v_cash, v_amount, 0), (v_tenant, v_entry, v_counter, 0, v_amount);
  else
    insert into public.journal_lines (tenant_id, journal_entry_id, account_id, debit, credit) values
      (v_tenant, v_entry, v_counter, v_amount, 0), (v_tenant, v_entry, v_cash, 0, v_amount);
  end if;
  perform public.assert_balanced_journal(v_entry);
  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  values (v_tenant, v_user, 'settle', 'transaction', v_tx.id, jsonb_build_object('amount', v_amount, 'payment_id', v_payment));
  return jsonb_build_object('id', v_payment, 'remaining', v_remaining, 'duplicate', false);
end;
$$;

create or replace function public.post_manual_journal(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_tenant();
  v_user uuid := auth.uid();
  v_entry uuid := gen_random_uuid();
  v_line jsonb;
  v_account uuid;
begin
  if not public.has_tenant_role(v_tenant, 'owner') then raise exception 'Hanya Owner yang dapat posting jurnal manual.'; end if;
  if jsonb_array_length(coalesce(p_payload->'lines', '[]'::jsonb)) < 2 then raise exception 'Jurnal minimal dua baris.'; end if;
  insert into public.journal_entries (id, tenant_id, number, date, description, source, created_by)
  values (v_entry, v_tenant, 'JE-MAN-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    (p_payload->>'date')::date, trim(p_payload->>'description'), 'manual', v_user);
  for v_line in select * from jsonb_array_elements(p_payload->'lines')
  loop
    v_account := (v_line->>'accountId')::uuid;
    if not exists (select 1 from public.accounts where id = v_account and tenant_id = v_tenant and active) then
      raise exception 'Akun jurnal tidak valid.';
    end if;
    insert into public.journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, memo)
    values (v_tenant, v_entry, v_account, coalesce((v_line->>'debit')::numeric, 0),
      coalesce((v_line->>'credit')::numeric, 0), nullif(v_line->>'memo', ''));
  end loop;
  perform public.assert_balanced_journal(v_entry);
  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id)
  values (v_tenant, v_user, 'post', 'manual_journal', v_entry);
  return jsonb_build_object('id', v_entry);
end;
$$;

create or replace function public.void_transaction(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_tenant();
  v_user uuid := auth.uid();
  v_original public.transactions%rowtype;
  v_void uuid;
  v_request uuid := (p_payload->>'client_request_id')::uuid;
  v_entry public.journal_entries%rowtype;
  v_reverse_entry uuid := gen_random_uuid();
  v_item public.transaction_items%rowtype;
  v_product public.products%rowtype;
  v_stock_after numeric;
begin
  if not public.has_tenant_role(v_tenant, 'owner') then raise exception 'Hanya Owner yang dapat membatalkan transaksi.'; end if;
  select * into v_original from public.transactions
  where id = (p_payload->>'transaction_id')::uuid and tenant_id = v_tenant and status = 'posted'
  for update;
  if not found or v_original.kind not in ('sale', 'purchase', 'expense') then raise exception 'Transaksi tidak dapat dibatalkan.'; end if;
  if v_original.payment_mode = 'credit' and exists (select 1 from public.payments where transaction_id = v_original.id) then
    raise exception 'Batalkan pembayaran invoice terlebih dahulu sebelum membatalkan transaksi.';
  end if;
  select * into v_entry from public.journal_entries where transaction_id = v_original.id and source = v_original.kind order by created_at limit 1;
  if not found then raise exception 'Jurnal transaksi tidak ditemukan.'; end if;

  if v_original.kind in ('sale', 'purchase') then
    for v_item in select * from public.transaction_items where transaction_id = v_original.id
    loop
      select * into v_product from public.products where id = v_item.product_id for update;
      if v_original.kind = 'sale' then
        v_stock_after := v_product.stock + v_item.quantity;
      else
        if v_product.stock < v_item.quantity then raise exception 'Stok % tidak cukup untuk membatalkan pembelian.', v_product.name; end if;
        v_stock_after := v_product.stock - v_item.quantity;
      end if;
      update public.products set stock = v_stock_after where id = v_product.id;
      insert into public.stock_movements (
        tenant_id, transaction_id, product_id, movement_type, quantity, unit_cost, stock_before, stock_after
      ) values (
        v_tenant, v_original.id, v_product.id,
        case when v_original.kind = 'sale' then 'void_sale' else 'void_purchase' end,
        case when v_original.kind = 'sale' then v_item.quantity else -v_item.quantity end,
        v_item.unit_cost, v_product.stock, v_stock_after
      );
    end loop;
  end if;

  insert into public.transactions (
    client_request_id, tenant_id, kind, payment_mode, number, date, description, total,
    paid_amount, remaining_amount, status, invoice_status, voids_transaction_id, created_by
  ) values (
    v_request, v_tenant, 'void', 'cash', 'VOID-' || v_original.number, coalesce((p_payload->>'date')::date, current_date),
    'Pembatalan ' || v_original.number, v_original.total, 0, 0, 'posted', 'paid', v_original.id, v_user
  ) returning id into v_void;
  update public.transactions set status = 'voided', invoice_status = case when payment_mode = 'credit' then 'paid' else invoice_status end where id = v_original.id;
  update public.journal_entries set status = 'reversed' where id = v_entry.id;
  insert into public.journal_entries (
    id, tenant_id, transaction_id, number, date, description, source, status, reverses_entry_id, created_by
  ) values (
    v_reverse_entry, v_tenant, v_void, 'REV-' || v_entry.number, current_date, 'Pembalikan ' || v_original.number,
    'void', 'posted', v_entry.id, v_user
  );
  insert into public.journal_lines (tenant_id, journal_entry_id, account_id, debit, credit, memo)
  select tenant_id, v_reverse_entry, account_id, credit, debit, 'Pembalikan ' || v_original.number
  from public.journal_lines where journal_entry_id = v_entry.id;
  perform public.assert_balanced_journal(v_reverse_entry);
  insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata)
  values (v_tenant, v_user, 'void', 'transaction', v_original.id, jsonb_build_object('void_id', v_void));
  return jsonb_build_object('id', v_void, 'voided_transaction_id', v_original.id);
end;
$$;

create or replace function public.sync_offline_transaction(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.require_tenant();
  v_job uuid := (p_payload->>'job_id')::uuid;
  v_type text := p_payload->>'job_type';
  v_body jsonb := p_payload->'payload';
  v_result jsonb;
begin
  begin
    if v_type = 'transaction' then v_result := public.post_transaction(v_body);
    elsif v_type = 'payment' then v_result := public.settle_invoice(v_body);
    elsif v_type = 'void' then v_result := public.void_transaction(v_body);
    elsif v_type = 'manual_journal' then v_result := public.post_manual_journal(v_body);
    else raise exception 'Jenis antrean offline tidak dikenal.';
    end if;
    return jsonb_build_object('status', 'posted', 'result', v_result);
  exception when others then
    insert into public.sync_conflicts (tenant_id, job_id, type, message, payload, created_by)
    values (v_tenant, v_job, v_type, sqlerrm, v_body, auth.uid())
    on conflict (tenant_id, job_id) do update set message = excluded.message, payload = excluded.payload;
    return jsonb_build_object('status', 'conflict', 'message', sqlerrm);
  end;
end;
$$;

create or replace function public.refresh_overdue_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.transactions
  set invoice_status = 'overdue'
  where payment_mode = 'credit' and status = 'posted' and remaining_amount > 0
    and due_date < current_date and invoice_status in ('unpaid', 'partial');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant usage on schema public to authenticated;
grant select on public.tenants, public.memberships, public.parties,
  public.transactions, public.transaction_items, public.payments, public.journal_entries,
  public.journal_lines, public.stock_movements, public.sync_conflicts, public.audit_logs to authenticated;
grant insert, update on public.parties, public.products to authenticated;
grant update on public.tenants, public.memberships, public.accounts, public.sync_conflicts to authenticated;
grant execute on function public.post_transaction(jsonb) to authenticated;
grant execute on function public.settle_invoice(jsonb) to authenticated;
grant execute on function public.post_manual_journal(jsonb) to authenticated;
grant execute on function public.void_transaction(jsonb) to authenticated;
grant execute on function public.sync_offline_transaction(jsonb) to authenticated;
grant execute on function public.list_products() to authenticated;
grant execute on function public.list_accounts() to authenticated;
