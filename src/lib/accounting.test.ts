import { describe, expect, it } from 'vitest'
import { demoAccounts, demoJournals, demoTransactions } from '../data/demo'
import { calculateAccountBalances, calculateMetrics, journalIsBalanced } from './accounting'

describe('accounting engine', () => {
  it('menolak jurnal yang tidak seimbang', () => {
    expect(journalIsBalanced([{ debit: 100, credit: 0 }, { debit: 0, credit: 90 }])).toBe(false)
  })

  it('menerima jurnal double-entry yang seimbang', () => {
    expect(journalIsBalanced([{ debit: 100, credit: 0 }, { debit: 0, credit: 100 }])).toBe(true)
  })

  it('menghitung saldo akun sesuai normal balance', () => {
    const balances = calculateAccountBalances(demoAccounts, demoJournals)
    expect(balances.find((item) => item.account.systemKey === 'cash')?.balance).toBe(11416000)
    expect(balances.find((item) => item.account.systemKey === 'sales_revenue')?.balance).toBe(1426000)
  })

  it('menghitung laba dari pendapatan dikurangi beban dan HPP', () => {
    const metrics = calculateMetrics(demoAccounts, demoJournals, demoTransactions)
    expect(metrics.profit).toBe(149500)
    expect(metrics.receivables).toBe(1250000)
    expect(metrics.payables).toBe(1800000)
  })
})
