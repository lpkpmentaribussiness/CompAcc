import type { Account } from '../types'

export const accountCodePattern = /^[A-Za-z0-9._-]{1,20}$/

export const normalBalanceForCategory = (
  category: Account['category']
): Account['normalBalance'] => ['asset', 'expense'].includes(category) ? 'debit' : 'credit'

export const validateAccountInput = (code: string, name: string) => {
  if (!accountCodePattern.test(code.trim())) {
    throw new Error('Kode akun hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda minus.')
  }
  if (!name.trim()) throw new Error('Nama akun wajib diisi.')
  if (name.trim().length > 120) throw new Error('Nama akun maksimal 120 karakter.')
}
