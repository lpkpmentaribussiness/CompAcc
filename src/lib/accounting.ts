import type { Account, DashboardMetrics, JournalEntry, Transaction } from '../types'

export interface AccountBalance {
  account: Account
  debit: number
  credit: number
  balance: number
}

export const calculateAccountBalances = (accounts: Account[], journals: JournalEntry[]): AccountBalance[] =>
  accounts.map((account) => {
    const lines = journals
      .filter((entry) => entry.status === 'posted')
      .flatMap((entry) => entry.lines)
      .filter((line) => line.accountId === account.id)
    const debit = lines.reduce((sum, line) => sum + line.debit, 0)
    const credit = lines.reduce((sum, line) => sum + line.credit, 0)
    return {
      account,
      debit,
      credit,
      balance: account.normalBalance === 'debit' ? debit - credit : credit - debit
    }
  })

export const calculateMetrics = (
  accounts: Account[],
  journals: JournalEntry[],
  transactions: Transaction[]
): DashboardMetrics => {
  const balances = calculateAccountBalances(accounts, journals)
  const bySystemKey = (key: string) =>
    balances.filter((item) => item.account.systemKey === key).reduce((sum, item) => sum + item.balance, 0)
  const byCategory = (category: Account['category']) =>
    balances.filter((item) => item.account.category === category).reduce((sum, item) => sum + item.balance, 0)
  const revenue = byCategory('revenue')
  const expenses = balances
    .filter((item) => item.account.category === 'expense' && item.account.systemKey !== 'cogs')
    .reduce((sum, item) => sum + item.balance, 0)
  const cogs = bySystemKey('cogs')
  const overdue = transactions
    .filter((item) => item.invoiceStatus === 'overdue' && item.status === 'posted')
    .reduce((sum, item) => sum + item.remainingAmount, 0)
  return {
    cash: bySystemKey('cash'),
    revenue,
    expenses,
    cogs,
    profit: revenue - expenses - cogs,
    inventory: bySystemKey('inventory'),
    receivables: bySystemKey('receivables'),
    payables: bySystemKey('payables'),
    overdue
  }
}

export const journalIsBalanced = (lines: Array<{ debit: number; credit: number }>) => {
  const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0)
  const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0)
  return debit > 0 && Math.abs(debit - credit) < 0.005
}
