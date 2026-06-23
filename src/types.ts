export type Role = 'owner' | 'cashier'
export type TransactionKind = 'sale' | 'purchase' | 'expense' | 'manual' | 'payment' | 'void'
export type PaymentMode = 'cash' | 'credit'
export type SyncState = 'online' | 'offline' | 'syncing' | 'success' | 'conflict'
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue'

export interface UserProfile {
  id: string
  email: string
  fullName: string
  role: Role
  tenantId: string
  tenantName: string
}

export interface Product {
  id: string
  tenantId: string
  sku: string
  name: string
  category: string
  purchasePrice: number
  sellingPrice: number
  stock: number
  minimumStock: number
  active: boolean
  updatedAt: string
}

export interface Party {
  id: string
  tenantId: string
  type: 'customer' | 'vendor' | 'both'
  name: string
  phone?: string
  email?: string
  address?: string
}

export interface Account {
  id: string
  tenantId: string
  code: string
  name: string
  category: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  normalBalance: 'debit' | 'credit'
  systemKey?: string
  active: boolean
}

export interface AccountDraft {
  id?: string
  code: string
  name: string
  category: Account['category']
}

export interface TransactionItem {
  id?: string
  productId: string
  sku: string
  name: string
  quantity: number
  unitPrice: number
  unitCost: number
  subtotal: number
}

export interface Transaction {
  id: string
  clientRequestId: string
  tenantId: string
  kind: TransactionKind
  paymentMode: PaymentMode
  number: string
  date: string
  dueDate?: string
  partyId?: string
  partyName?: string
  description: string
  total: number
  paidAmount: number
  remainingAmount: number
  status: 'posted' | 'voided'
  invoiceStatus?: InvoiceStatus
  items: TransactionItem[]
  createdBy: string
  createdAt: string
  voidsTransactionId?: string
}

export interface Payment {
  id: string
  tenantId: string
  transactionId: string
  date: string
  amount: number
  accountId: string
  note?: string
}

export interface JournalLine {
  id?: string
  accountId: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
  memo?: string
}

export interface JournalEntry {
  id: string
  tenantId: string
  transactionId?: string
  number: string
  date: string
  description: string
  source: TransactionKind
  status: 'posted' | 'reversed'
  lines: JournalLine[]
  createdAt: string
}

export interface OfflineJob {
  id: string
  tenantId: string
  type: 'transaction' | 'payment' | 'void' | 'manual_journal'
  payload: Record<string, unknown>
  createdAt: string
  attempts: number
  state: 'pending' | 'syncing' | 'conflict'
  error?: string
}

export interface SyncConflict {
  id: string
  tenantId: string
  jobId: string
  type: string
  message: string
  payload: Record<string, unknown>
  createdAt: string
  resolvedAt?: string
}

export interface DashboardMetrics {
  cash: number
  revenue: number
  expenses: number
  cogs: number
  profit: number
  inventory: number
  receivables: number
  payables: number
  overdue: number
}

export interface TransactionDraft {
  clientRequestId: string
  kind: 'sale' | 'purchase' | 'expense'
  paymentMode: PaymentMode
  date: string
  dueDate?: string
  partyId?: string
  partyName?: string
  description: string
  cashAccountId?: string
  expenseAccountId?: string
  total: number
  items: TransactionItem[]
}

export interface AppSnapshot {
  products: Product[]
  parties: Party[]
  accounts: Account[]
  transactions: Transaction[]
  payments: Payment[]
  journals: JournalEntry[]
  conflicts: SyncConflict[]
}
