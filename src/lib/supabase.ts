import { createClient } from '@supabase/supabase-js'
import type { AccountDraft, TransactionDraft } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudEnabled = Boolean(url && anonKey)

const headerSafeValue = (value: string) => value.replace(/[^\x20-\x7E]/g, '').trim()

const cleanHeaders = (headers?: HeadersInit): HeadersInit | undefined => {
  if (!headers) return undefined

  if (headers instanceof Headers) {
    const clean = new Headers()
    headers.forEach((value, key) => clean.set(key, headerSafeValue(value)))
    return clean
  }

  if (Array.isArray(headers)) {
    return headers.map(([key, value]) => [key, headerSafeValue(String(value))])
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, headerSafeValue(String(value))])
  )
}

const headerSafeFetch: typeof fetch = (input, init) =>
  fetch(input, init ? { ...init, headers: cleanHeaders(init.headers) } : init)

export const supabase = cloudEnabled
  ? createClient(headerSafeValue(url!), headerSafeValue(anonKey!), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      global: {
        fetch: headerSafeFetch
      }
    })
  : null

const rpc = async <T>(name: string, params: Record<string, unknown>): Promise<T> => {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.')
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw error
  return data as T
}

export const cloudApi = {
  postTransaction: (draft: TransactionDraft) => rpc('post_transaction', { p_payload: draft }),
  settleInvoice: (payload: Record<string, unknown>) => rpc('settle_invoice', { p_payload: payload }),
  postManualJournal: (payload: Record<string, unknown>) => rpc('post_manual_journal', { p_payload: payload }),
  voidTransaction: (payload: Record<string, unknown>) => rpc('void_transaction', { p_payload: payload }),
  syncOfflineTransaction: (payload: Record<string, unknown>) => rpc('sync_offline_transaction', { p_payload: payload }),
  saveAccount: (draft: AccountDraft) => rpc('save_account', { p_payload: draft }),
  setAccountActive: (accountId: string, active: boolean) =>
    rpc('set_account_active', { p_account_id: accountId, p_active: active })
}
