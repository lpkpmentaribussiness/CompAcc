import { describe, expect, it } from 'vitest'
import { demoSnapshot } from '../data/demo'
import { calculateAccountBalances } from './accounting'
import { deleteOrMergeAccount, getAccountUsage, normalBalanceForCategory, validateAccountInput } from './accounts'

describe('account management rules', () => {
  it('menentukan normal balance berdasarkan kategori', () => {
    expect(normalBalanceForCategory('asset')).toBe('debit')
    expect(normalBalanceForCategory('expense')).toBe('debit')
    expect(normalBalanceForCategory('liability')).toBe('credit')
    expect(normalBalanceForCategory('equity')).toBe('credit')
    expect(normalBalanceForCategory('revenue')).toBe('credit')
  })

  it('menerima format kode akun yang didukung', () => {
    expect(() => validateAccountInput('5110-OPS_1', 'Beban Operasional')).not.toThrow()
  })

  it('menolak kode akun yang tidak valid', () => {
    expect(() => validateAccountInput('51 10', 'Beban Operasional')).toThrow('Kode akun')
    expect(() => validateAccountInput('5110/OPS', 'Beban Operasional')).toThrow('Kode akun')
  })

  it('menolak nama akun kosong atau terlalu panjang', () => {
    expect(() => validateAccountInput('5110', '  ')).toThrow('Nama akun wajib')
    expect(() => validateAccountInput('5110', 'A'.repeat(121))).toThrow('maksimal 120')
  })

  it('menghapus permanen akun tambahan yang belum dipakai', () => {
    const result = deleteOrMergeAccount(demoSnapshot, 'acc-rent')
    expect(result.accounts.some((account) => account.id === 'acc-rent')).toBe(false)
  })

  it('mewajibkan akun tujuan untuk akun yang sudah dipakai', () => {
    expect(getAccountUsage(demoSnapshot, 'acc-utilities').journalLines).toBe(1)
    expect(() => deleteOrMergeAccount(demoSnapshot, 'acc-utilities')).toThrow('Pilih akun tujuan')
  })

  it('mengalihkan jurnal ke akun aktif sekategori lalu menghapus akun asal', () => {
    const before = calculateAccountBalances(demoSnapshot.accounts, demoSnapshot.journals)
    const combinedBefore = before
      .filter(({ account }) => ['acc-utilities', 'acc-rent'].includes(account.id))
      .reduce((sum, item) => sum + item.balance, 0)
    const result = deleteOrMergeAccount(demoSnapshot, 'acc-utilities', 'acc-rent')
    const after = calculateAccountBalances(result.accounts, result.journals)
    expect(result.accounts.some((account) => account.id === 'acc-utilities')).toBe(false)
    expect(result.journals.flatMap((journal) => journal.lines).some((line) => line.accountId === 'acc-utilities')).toBe(false)
    expect(result.journals.flatMap((journal) => journal.lines).find((line) => line.debit === 760000)).toMatchObject({
      accountId: 'acc-rent',
      accountCode: '5100',
      accountName: 'Beban Sewa'
    })
    expect(after.find(({ account }) => account.id === 'acc-rent')?.balance).toBe(combinedBefore)
    expect(result.journals.every((journal) =>
      journal.lines.reduce((sum, line) => sum + line.debit, 0) ===
      journal.lines.reduce((sum, line) => sum + line.credit, 0)
    )).toBe(true)
  })

  it('mengalihkan referensi pembayaran ke akun tujuan', () => {
    const source = {
      id: 'acc-transfer',
      tenantId: 'tenant-demo',
      code: '1010',
      name: 'Rekening Transfer',
      category: 'asset' as const,
      normalBalance: 'debit' as const,
      active: true
    }
    const snapshot = {
      ...demoSnapshot,
      accounts: [...demoSnapshot.accounts, source],
      payments: demoSnapshot.payments.map((payment, index) =>
        index === 0 ? { ...payment, accountId: source.id } : payment
      )
    }
    const result = deleteOrMergeAccount(snapshot, source.id, 'acc-cash')
    expect(result.accounts.some((account) => account.id === source.id)).toBe(false)
    expect(result.payments.every((payment) => payment.accountId !== source.id)).toBe(true)
    expect(result.payments[0].accountId).toBe('acc-cash')
  })

  it('menolak akun tujuan yang berbeda kategori atau nonaktif', () => {
    expect(() => deleteOrMergeAccount(demoSnapshot, 'acc-utilities', 'acc-cash')).toThrow('kategori yang sama')
    const inactiveTarget = {
      ...demoSnapshot,
      accounts: demoSnapshot.accounts.map((account) =>
        account.id === 'acc-rent' ? { ...account, active: false } : account
      )
    }
    expect(() => deleteOrMergeAccount(inactiveTarget, 'acc-utilities', 'acc-rent')).toThrow('harus aktif')
  })

  it('melindungi akun sistem dari penghapusan', () => {
    expect(() => deleteOrMergeAccount(demoSnapshot, 'acc-cash')).toThrow('Akun sistem')
  })
})
