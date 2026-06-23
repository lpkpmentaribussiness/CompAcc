import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const redirectTo = 'https://comp-acc.vercel.app'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) throw new Error('Sesi tidak tersedia.')

    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
    const adminClient = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: userData, error: userError } = await callerClient.auth.getUser()
    if (userError || !userData.user) throw new Error('Sesi tidak valid.')

    const { data: creator } = await adminClient
      .from('platform_creator')
      .select('user_id')
      .eq('singleton', true)
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (!creator) throw new Error('Hanya Creator yang dapat mengelola perusahaan.')

    const body = await request.json()
    const action = String(body.action ?? '')

    if (action === 'send_access') {
      const tenantId = String(body.tenantId ?? '')
      const { data: owner, error: ownerError } = await adminClient
        .from('memberships')
        .select('email')
        .eq('tenant_id', tenantId)
        .eq('role', 'owner')
        .eq('active', true)
        .single()
      if (ownerError || !owner) throw new Error('Owner aktif tidak ditemukan.')

      const { error } = await callerClient.auth.resetPasswordForEmail(owner.email, { redirectTo })
      if (error) throw error
      return json({ status: 'sent' })
    }

    const ownerEmail = String(body.ownerEmail ?? '').trim().toLowerCase()
    const ownerName = String(body.ownerName ?? '').trim()
    if (!ownerEmail || !ownerName) throw new Error('Nama dan email Owner wajib diisi.')

    const { data: existingMembership } = await adminClient
      .from('memberships')
      .select('id')
      .eq('email', ownerEmail)
      .maybeSingle()
    if (existingMembership) throw new Error('Email Owner sudah terhubung ke perusahaan lain.')

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(ownerEmail, {
      data: { full_name: ownerName, role: 'owner' },
      redirectTo
    })
    if (inviteError || !invited.user) throw inviteError ?? new Error('Undangan Owner gagal dibuat.')

    try {
      if (action === 'provision') {
        const companyName = String(body.companyName ?? '').trim()
        const companyEmail = String(body.companyEmail ?? '').trim().toLowerCase()
        const { data, error } = await callerClient.rpc('provision_company', {
          p_name: companyName,
          p_email: companyEmail,
          p_owner_user_id: invited.user.id,
          p_owner_name: ownerName,
          p_owner_email: ownerEmail
        })
        if (error) throw error
        return json({ tenantId: data, ownerId: invited.user.id })
      }

      if (action === 'replace_owner') {
        const tenantId = String(body.tenantId ?? '')
        const { error } = await callerClient.rpc('replace_company_owner', {
          p_tenant_id: tenantId,
          p_owner_user_id: invited.user.id,
          p_owner_name: ownerName,
          p_owner_email: ownerEmail
        })
        if (error) throw error
        return json({ tenantId, ownerId: invited.user.id })
      }

      throw new Error('Aksi Creator tidak dikenal.')
    } catch (error) {
      await adminClient.auth.admin.deleteUser(invited.user.id)
      throw error
    }
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      400
    )
  }
})

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status
  })
}
