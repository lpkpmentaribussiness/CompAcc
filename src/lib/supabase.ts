import { createClient } from '@supabase/supabase-js'
import type { AccountDraft, TransactionDraft } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudEnabled = Boolean(url && anonKey)

export const supabase = cloudEnabled
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
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
