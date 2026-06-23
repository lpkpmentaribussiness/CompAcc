import type { Account, AppSnapshot } from '../types'

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

export const getAccountUsage = (snapshot: AppSnapshot, accountId: string) => ({
  journalLines: snapshot.journals.reduce(
    (count, journal) => count + journal.lines.filter((line) => line.accountId === accountId).length,
    0
  ),
  payments: snapshot.payments.filter((payment) => payment.accountId === accountId).length
})

export const deleteOrMergeAccount = (
  snapshot: AppSnapshot,
  accountId: string,
  targetAccountId?: string
): AppSnapshot => {
  const source = snapshot.accounts.find((account) => account.id === accountId)
  if (!source) throw new Error('Akun tidak ditemukan.')
  if (source.systemKey) throw new Error('Akun sistem tidak dapat dihapus.')

  const usage = getAccountUsage(snapshot, accountId)
  const isUsed = usage.journalLines + usage.payments > 0

  if (isUsed && !targetAccountId) {
    throw new Error('Akun sudah memiliki riwayat. Pilih akun tujuan pengalihan.')
  }
  if (!isUsed && targetAccountId) {
    throw new Error('Akun yang belum dipakai tidak memerlukan akun tujuan.')
  }

  const target = targetAccountId
    ? snapshot.accounts.find((account) => account.id === targetAccountId)
    : undefined

  if (targetAccountId === accountId) throw new Error('Akun tujuan tidak boleh sama dengan akun asal.')
  if (targetAccountId && !target) throw new Error('Akun tujuan tidak ditemukan.')
  if (target && !target.active) throw new Error('Akun tujuan harus aktif.')
  if (target && target.category !== source.category) {
    throw new Error('Akun tujuan harus memiliki kategori yang sama.')
  }

  return {
    ...snapshot,
    accounts: snapshot.accounts.filter((account) => account.id !== accountId),
    payments: snapshot.payments.map((payment) =>
      payment.accountId === accountId && target
        ? { ...payment, accountId: target.id }
        : payment
    ),
    journals: snapshot.journals.map((journal) => ({
      ...journal,
      lines: journal.lines.map((line) =>
        line.accountId === accountId && target
          ? {
              ...line,
              accountId: target.id,
              accountCode: target.code,
              accountName: target.name
            }
          : line
      )
    }))
  }
}
