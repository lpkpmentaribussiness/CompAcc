import { createClient } from '@supabase/supabase-js'

const [email, password, tenantName, ownerName = 'Owner'] = process.argv.slice(2)
const url = process.env.SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRole) {
  console.error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.')
  process.exit(1)
}
if (!email || !password || !tenantName) {
  console.error('Pemakaian: npm run bootstrap:tenant -- owner@email.com password "Nama Usaha" "Nama Owner"')
  process.exit(1)
}

const supabase = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const slug = tenantName
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[^\w\s-]/g, '')
  .trim()
  .replace(/[\s_]+/g, '-')
  .slice(0, 50)

const { data: userResult, error: userError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: ownerName }
})
if (userError) throw userError

const { data: tenant, error: tenantError } = await supabase
  .from('tenants')
  .insert({ name: tenantName, slug: `${slug}-${Date.now().toString().slice(-6)}`, email })
  .select()
  .single()
if (tenantError) throw tenantError

const { error: membershipError } = await supabase.from('memberships').insert({
  tenant_id: tenant.id,
  user_id: userResult.user.id,
  full_name: ownerName,
  email: email.trim().toLowerCase(),
  role: 'owner'
})
if (membershipError) throw membershipError

const accounts = [
  ['1000', 'Kas & Bank', 'asset', 'debit', 'cash'],
  ['1100', 'Piutang Usaha', 'asset', 'debit', 'receivables'],
  ['1150', 'Persediaan Barang', 'asset', 'debit', 'inventory'],
  ['2000', 'Utang Usaha', 'liability', 'credit', 'payables'],
  ['3000', 'Modal Pemilik', 'equity', 'credit', 'capital'],
  ['4000', 'Pendapatan Penjualan', 'revenue', 'credit', 'sales_revenue'],
  ['5050', 'Harga Pokok Penjualan', 'expense', 'debit', 'cogs'],
  ['5100', 'Beban Sewa', 'expense', 'debit', null],
  ['5200', 'Beban Listrik & Internet', 'expense', 'debit', null],
  ['5300', 'Beban Operasional Lainnya', 'expense', 'debit', null]
].map(([code, name, category, normal_balance, system_key]) => ({
  tenant_id: tenant.id, code, name, category, normal_balance, system_key
}))

const { error: accountError } = await supabase.from('accounts').insert(accounts)
if (accountError) throw accountError

console.log(JSON.stringify({
  tenantId: tenant.id,
  tenantName: tenant.name,
  ownerId: userResult.user.id,
  ownerEmail: email
}, null, 2))
