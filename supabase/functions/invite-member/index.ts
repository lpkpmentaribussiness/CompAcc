import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

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

    const { tenantId, email, fullName } = await request.json()
    const cleanEmail = String(email ?? '').trim().toLowerCase()
    const cleanFullName = String(fullName ?? '').trim()
    if (!tenantId || !cleanEmail || !cleanFullName) throw new Error('Data undangan tidak valid.')

    const { data: membership, error: membershipError } = await adminClient
      .from('memberships')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userData.user.id)
      .eq('role', 'owner')
      .eq('active', true)
      .single()
    if (membershipError || !membership) throw new Error('Hanya Owner yang dapat mengundang pengguna.')

    const { data: existingMembership } = await adminClient
      .from('memberships')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle()
    if (existingMembership) throw new Error('Email sudah terhubung ke perusahaan lain.')

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(cleanEmail, {
      data: { full_name: cleanFullName, tenant_id: tenantId, role: 'cashier' },
      redirectTo: 'https://comp-acc.vercel.app'
    })
    if (inviteError) throw inviteError

    const { data: created, error: createError } = await adminClient
      .from('memberships')
      .upsert({
        tenant_id: tenantId,
        user_id: invited.user.id,
        full_name: cleanFullName,
        email: cleanEmail,
        role: 'cashier',
        active: true
      }, {
        onConflict: 'tenant_id,email'
      })
      .select('id')
      .single()
    if (createError) throw createError

    return new Response(JSON.stringify({ membershipId: created.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
