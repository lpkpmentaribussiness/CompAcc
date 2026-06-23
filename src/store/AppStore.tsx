/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { demoSnapshot, demoUser } from '../data/demo'
import { calculateMetrics, journalIsBalanced } from '../lib/accounting'
import { deleteOrMergeAccount, normalBalanceForCategory, validateAccountInput } from '../lib/accounts'
import { makeId, today } from '../lib/format'
import { offlineStore } from '../lib/offline'
import { cloudApi, cloudEnabled, supabase } from '../lib/supabase'
import type {
  Account,
  AccountDraft,
  AppSnapshot,
  JournalEntry,
  JournalLine,
  OfflineJob,
  Party,
  Payment,
  Product,
  SyncConflict,
  SyncState,
  Transaction,
  TransactionDraft,
  UserProfile
} from '../types'

interface AppStoreValue {
  user: UserProfile | null
  snapshot: AppSnapshot
  metrics: ReturnType<typeof calculateMetrics>
  syncState: SyncState
  pendingJobs: OfflineJob[]
  loading: boolean
  demoMode: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  changePassword: (newPassword: string) => Promise<void>
  postTransaction: (draft: TransactionDraft) => Promise<Transaction>
  settleInvoice: (transactionId: string, amount: number, note?: string) => Promise<void>
  postManualJournal: (date: string, description: string, lines: JournalLine[]) => Promise<void>
  voidTransaction: (transactionId: string) => Promise<void>
  saveProduct: (product: Partial<Product> & Pick<Product, 'sku' | 'name'>) => Promise<void>
  saveParty: (party: Partial<Party> & Pick<Party, 'name' | 'type'>) => Promise<void>
  saveAccount: (draft: AccountDraft) => Promise<void>
  setAccountActive: (accountId: string, active: boolean) => Promise<void>
  deleteAccount: (accountId: string, targetAccountId?: string) => Promise<void>
  syncNow: () => Promise<void>
  retryConflict: (conflictId: string) => Promise<void>
  discardConflict: (conflictId: string) => Promise<void>
}

const AppStore = createContext<AppStoreValue | null>(null)

const cloneDemo = (): AppSnapshot => structuredClone(demoSnapshot)

const systemAccount = (accounts: Account[], key: string) => {
  const account = accounts.find((item) => item.systemKey === key)
  if (!account) throw new Error(`Akun sistem ${key} belum tersedia.`)
  return account
}

const line = (account: Account, debit = 0, credit = 0): JournalLine => ({
  accountId: account.id,
  accountCode: account.code,
  accountName: account.name,
  debit,
  credit
})

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [snapshot, setSnapshot] = useState<AppSnapshot>(cloneDemo)
  const [syncState, setSyncState] = useState<SyncState>(navigator.onLine ? 'online' : 'offline')
  const [pendingJobs, setPendingJobs] = useState<OfflineJob[]>([])
  const [loading, setLoading] = useState(cloudEnabled)

  const refreshJobs = useCallback(async () => setPendingJobs(await offlineStore.listJobs()), [])

  const loadCloudSnapshot = useCallback(async (activeUser: UserProfile) => {
    if (!supabase) return
    const [products, parties, accounts, transactions, payments, journals, conflicts] = await Promise.all([
      supabase.rpc('list_products'),
      supabase.from('parties').select('*').eq('tenant_id', activeUser.tenantId).order('name'),
      supabase.rpc('list_accounts'),
      supabase.from('transactions').select('*, transaction_items(*)').eq('tenant_id', activeUser.tenantId).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('tenant_id', activeUser.tenantId).order('date', { ascending: false }),
      supabase.from('journal_entries').select('*, journal_lines(*, accounts(code,name))').eq('tenant_id', activeUser.tenantId).order('created_at', { ascending: false }),
      supabase.from('sync_conflicts').select('*').eq('tenant_id', activeUser.tenantId).is('resolved_at', null).order('created_at', { ascending: false })
    ])
    const failure = [products, parties, accounts, transactions, payments, journals, conflicts].find((result) => result.error)
    if (failure?.error) throw failure.error
    const next: AppSnapshot = {
      products: (products.data ?? []).map((item: Record<string, unknown>) => ({
        id: String(item.id), tenantId: String(item.tenant_id), sku: String(item.sku), name: String(item.name), category: String(item.category),
        purchasePrice: Number(item.purchase_price), sellingPrice: Number(item.selling_price), stock: Number(item.stock),
        minimumStock: Number(item.minimum_stock), active: Boolean(item.active), updatedAt: String(item.updated_at)
      })),
      parties: (parties.data ?? []).map((item) => ({
        id: item.id, tenantId: item.tenant_id, type: item.type, name: item.name,
        phone: item.phone, email: item.email, address: item.address
      })),
      accounts: (accounts.data ?? []).map((item: Record<string, unknown>) => ({
        id: String(item.id), tenantId: String(item.tenant_id), code: String(item.code), name: String(item.name),
        category: item.category as Account['category'], normalBalance: item.normal_balance as Account['normalBalance'],
        systemKey: item.system_key ? String(item.system_key) : undefined, active: Boolean(item.active)
      })),
      transactions: (transactions.data ?? []).map((item) => ({
        id: item.id, clientRequestId: item.client_request_id, tenantId: item.tenant_id, kind: item.kind,
        paymentMode: item.payment_mode, number: item.number, date: item.date, dueDate: item.due_date,
        partyId: item.party_id, partyName: item.party_name, description: item.description, total: Number(item.total),
        paidAmount: Number(item.paid_amount), remainingAmount: Number(item.remaining_amount), status: item.status,
        invoiceStatus: item.invoice_status, createdBy: item.created_by, createdAt: item.created_at,
        voidsTransactionId: item.voids_transaction_id,
        items: (item.transaction_items ?? []).map((entry: Record<string, unknown>) => ({
          id: String(entry.id), productId: String(entry.product_id), sku: String(entry.sku), name: String(entry.name),
          quantity: Number(entry.quantity), unitPrice: Number(entry.unit_price), unitCost: Number(entry.unit_cost),
          subtotal: Number(entry.subtotal)
        }))
      })),
      payments: (payments.data ?? []).map((item) => ({
        id: item.id, tenantId: item.tenant_id, transactionId: item.transaction_id, date: item.date,
        amount: Number(item.amount), accountId: item.account_id, note: item.note
      })),
      journals: (journals.data ?? []).map((item) => ({
        id: item.id, tenantId: item.tenant_id, transactionId: item.transaction_id, number: item.number,
        date: item.date, description: item.description, source: item.source, status: item.status,
        createdAt: item.created_at,
        lines: (item.journal_lines ?? []).map((entry: Record<string, unknown>) => {
          const joined = entry.accounts as Record<string, unknown> | undefined
          return {
            id: String(entry.id), accountId: String(entry.account_id), accountCode: String(joined?.code ?? ''),
            accountName: String(joined?.name ?? ''), debit: Number(entry.debit), credit: Number(entry.credit),
            memo: String(entry.memo ?? '')
          }
        })
      })),
      conflicts: (conflicts.data ?? []).map((item) => ({
        id: item.id, tenantId: item.tenant_id, jobId: item.job_id, type: item.type, message: item.message,
        payload: item.payload, createdAt: item.created_at, resolvedAt: item.resolved_at
      }))
    }
    setSnapshot(next)
    await offlineStore.saveSnapshot(activeUser.tenantId, next)
  }, [])

  useEffect(() => {
    refreshJobs()
    const online = () => setSyncState('online')
    const offline = () => setSyncState('offline')
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [refreshJobs])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true
    client.auth.getSession().then(async ({ data }) => {
      if (!active) return
      if (!data.session) {
        setLoading(false)
        return
      }
      const { data: profiles, error } = await client.rpc('get_current_profile')
      const profile = profiles?.[0]
      if (error || !profile) {
        await client.auth.signOut()
        setUser(null)
        setLoading(false)
        return
      }
      const activeUser: UserProfile = {
        id: data.session.user.id,
        email: data.session.user.email ?? '',
        fullName: profile.full_name,
        role: profile.role,
        tenantId: profile.tenant_id,
        tenantName: profile.tenant_name,
        tenantActive: Boolean(profile.tenant_active),
        isPlatformCreator: Boolean(profile.is_platform_creator)
      }
      setUser(activeUser)
      if (!activeUser.tenantActive) {
        setLoading(false)
        return
      }
      try {
        await loadCloudSnapshot(activeUser)
      } catch {
        const cached = await offlineStore.getSnapshot(activeUser.tenantId)
        if (cached) setSnapshot(cached)
      } finally {
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [loadCloudSnapshot])

  const enqueue = useCallback(async (type: OfflineJob['type'], payload: Record<string, unknown>) => {
    if (!user) throw new Error('Pengguna belum login.')
    const job: OfflineJob = {
      id: makeId(), tenantId: user.tenantId, type, payload, createdAt: new Date().toISOString(),
      attempts: 0, state: 'pending'
    }
    await offlineStore.putJob(job)
    await refreshJobs()
    setSyncState('offline')
  }, [refreshJobs, user])

  const postLocalTransaction = useCallback((draft: TransactionDraft): Transaction => {
    if (!user) throw new Error('Pengguna belum login.')
    const id = makeId()
    const credit = draft.paymentMode === 'credit'
    const transaction: Transaction = {
      id, clientRequestId: draft.clientRequestId, tenantId: user.tenantId, kind: draft.kind,
      paymentMode: draft.paymentMode, number: `${draft.kind === 'sale' ? 'SAL' : draft.kind === 'purchase' ? 'PUR' : 'EXP'}-${Date.now()}`,
      date: draft.date, dueDate: draft.dueDate, partyId: draft.partyId, partyName: draft.partyName,
      description: draft.description, total: draft.total, paidAmount: credit ? 0 : draft.total,
      remainingAmount: credit ? draft.total : 0, status: 'posted', invoiceStatus: credit ? 'unpaid' : 'paid',
      items: draft.items, createdBy: user.id, createdAt: new Date().toISOString()
    }
    setSnapshot((current) => {
      const accounts = current.accounts
      const cash = systemAccount(accounts, 'cash')
      const inventory = systemAccount(accounts, 'inventory')
      const revenue = systemAccount(accounts, 'sales_revenue')
      const cogs = systemAccount(accounts, 'cogs')
      const receivables = systemAccount(accounts, 'receivables')
      const payables = systemAccount(accounts, 'payables')
      const journalLines: JournalLine[] = []
      let products = [...current.products]
      if (draft.kind === 'sale') {
        const totalCost = draft.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
        journalLines.push(line(credit ? receivables : cash, draft.total), line(revenue, 0, draft.total))
        journalLines.push(line(cogs, totalCost), line(inventory, 0, totalCost))
        products = products.map((product) => {
          const item = draft.items.find((entry) => entry.productId === product.id)
          return item ? { ...product, stock: product.stock - item.quantity } : product
        })
      } else if (draft.kind === 'purchase') {
        journalLines.push(line(inventory, draft.total), line(credit ? payables : cash, 0, draft.total))
        products = products.map((product) => {
          const item = draft.items.find((entry) => entry.productId === product.id)
          if (!item) return product
          const newStock = product.stock + item.quantity
          const newCost = newStock > 0
            ? ((product.stock * product.purchasePrice) + item.subtotal) / newStock
            : item.unitPrice
          return { ...product, stock: newStock, purchasePrice: newCost }
        })
      } else {
        const expense = current.accounts.find((item) => item.id === draft.expenseAccountId)
        if (!expense) throw new Error('Pilih akun beban.')
        journalLines.push(line(expense, draft.total), line(cash, 0, draft.total))
      }
      const journal: JournalEntry = {
        id: makeId(), tenantId: user.tenantId, transactionId: id, number: `JE-${Date.now()}`,
        date: draft.date, description: draft.description, source: draft.kind, status: 'posted',
        lines: journalLines, createdAt: new Date().toISOString()
      }
      return { ...current, products, transactions: [transaction, ...current.transactions], journals: [journal, ...current.journals] }
    })
    return transaction
  }, [user])

  const postTransaction = useCallback(async (draft: TransactionDraft) => {
    if (!navigator.onLine || !cloudEnabled) {
      if (cloudEnabled) await enqueue('transaction', draft as unknown as Record<string, unknown>)
      return postLocalTransaction(draft)
    }
    const result = await cloudApi.postTransaction(draft) as { id: string; number: string }
    if (user) await loadCloudSnapshot(user)
    const posted: Transaction = {
      id: result.id,
      clientRequestId: draft.clientRequestId,
      tenantId: user?.tenantId ?? '',
      kind: draft.kind,
      paymentMode: draft.paymentMode,
      number: result.number,
      date: draft.date,
      dueDate: draft.dueDate,
      partyId: draft.partyId,
      partyName: draft.partyName,
      description: draft.description,
      total: draft.total,
      paidAmount: draft.paymentMode === 'cash' ? draft.total : 0,
      remainingAmount: draft.paymentMode === 'credit' ? draft.total : 0,
      status: 'posted',
      invoiceStatus: draft.paymentMode === 'credit' ? 'unpaid' : 'paid',
      items: draft.items,
      createdBy: user?.id ?? '',
      createdAt: new Date().toISOString()
    }
    return posted
  }, [enqueue, loadCloudSnapshot, postLocalTransaction, user])

  const settleInvoice = useCallback(async (transactionId: string, amount: number, note?: string) => {
    if (amount <= 0) throw new Error('Nominal pembayaran harus lebih besar dari nol.')
    const target = snapshot.transactions.find((item) => item.id === transactionId)
    if (!target) throw new Error('Invoice tidak ditemukan.')
    if (amount > target.remainingAmount) throw new Error('Pembayaran tidak boleh melebihi sisa tagihan.')
    if (cloudEnabled && navigator.onLine) {
      await cloudApi.settleInvoice({ client_request_id: makeId(), transaction_id: transactionId, amount, date: today(), note })
      if (user) await loadCloudSnapshot(user)
      return
    }
    if (cloudEnabled) await enqueue('payment', { client_request_id: makeId(), transaction_id: transactionId, amount, date: today(), note })
    setSnapshot((current) => {
      const cash = systemAccount(current.accounts, 'cash')
      const counter = systemAccount(current.accounts, target.kind === 'sale' ? 'receivables' : 'payables')
      const payment: Payment = { id: makeId(), tenantId: target.tenantId, transactionId, date: today(), amount, accountId: cash.id, note }
      const remaining = target.remainingAmount - amount
      const updated = current.transactions.map((item) => item.id === transactionId ? {
        ...item, paidAmount: item.paidAmount + amount, remainingAmount: remaining, invoiceStatus: remaining <= 0 ? 'paid' as const : 'partial' as const
      } : item)
      const journal: JournalEntry = {
        id: makeId(), tenantId: target.tenantId, transactionId, number: `JE-PAY-${Date.now()}`, date: today(),
        description: `${target.kind === 'sale' ? 'Penerimaan piutang' : 'Pembayaran utang'} ${target.number}`,
        source: 'payment', status: 'posted', createdAt: new Date().toISOString(),
        lines: target.kind === 'sale' ? [line(cash, amount), line(counter, 0, amount)] : [line(counter, amount), line(cash, 0, amount)]
      }
      return { ...current, transactions: updated, payments: [payment, ...current.payments], journals: [journal, ...current.journals] }
    })
  }, [enqueue, loadCloudSnapshot, snapshot.transactions, user])

  const postManualJournal = useCallback(async (date: string, description: string, lines: JournalLine[]) => {
    if (user?.role !== 'owner') throw new Error('Hanya Owner yang dapat membuat jurnal manual.')
    if (!journalIsBalanced(lines)) throw new Error('Total debit dan kredit harus seimbang.')
    if (cloudEnabled && navigator.onLine) {
      await cloudApi.postManualJournal({ client_request_id: makeId(), date, description, lines })
      if (user) await loadCloudSnapshot(user)
      return
    }
    if (cloudEnabled) await enqueue('manual_journal', { client_request_id: makeId(), date, description, lines })
    setSnapshot((current) => ({
      ...current,
      journals: [{
        id: makeId(), tenantId: user?.tenantId ?? '', number: `JE-MAN-${Date.now()}`, date, description,
        source: 'manual', status: 'posted', lines, createdAt: new Date().toISOString()
      }, ...current.journals]
    }))
  }, [enqueue, loadCloudSnapshot, user])

  const voidTransaction = useCallback(async (transactionId: string) => {
    const target = snapshot.transactions.find((item) => item.id === transactionId)
    if (!target || target.status === 'voided') throw new Error('Transaksi tidak dapat dibatalkan.')
    if (cloudEnabled && navigator.onLine) {
      await cloudApi.voidTransaction({ client_request_id: makeId(), transaction_id: transactionId, date: today() })
      if (user) await loadCloudSnapshot(user)
      return
    }
    if (cloudEnabled) await enqueue('void', { client_request_id: makeId(), transaction_id: transactionId, date: today() })
    setSnapshot((current) => {
      const original = current.journals.find((entry) => entry.transactionId === transactionId)
      const reversal = original ? {
        ...original, id: makeId(), number: `REV-${original.number}`, date: today(), source: 'void' as const,
        description: `Pembalikan ${target.number}`, lines: original.lines.map((entry) => ({ ...entry, debit: entry.credit, credit: entry.debit })),
        createdAt: new Date().toISOString()
      } : null
      const products = target.kind === 'sale'
        ? current.products.map((product) => {
            const item = target.items.find((entry) => entry.productId === product.id)
            return item ? { ...product, stock: product.stock + item.quantity } : product
          })
        : current.products
      return {
        ...current, products,
        transactions: current.transactions.map((item) => item.id === transactionId ? { ...item, status: 'voided' as const } : item),
        journals: reversal ? [reversal, ...current.journals] : current.journals
      }
    })
  }, [enqueue, loadCloudSnapshot, snapshot.transactions, user])

  const saveProduct = useCallback(async (product: Partial<Product> & Pick<Product, 'sku' | 'name'>) => {
    if (!user) return
    if (supabase) {
      const payload = {
        id: product.id, tenant_id: user.tenantId, sku: product.sku, name: product.name,
        category: product.category ?? 'Umum', purchase_price: product.purchasePrice ?? 0,
        selling_price: product.sellingPrice ?? 0, stock: product.stock ?? 0,
        minimum_stock: product.minimumStock ?? 0, active: product.active ?? true
      }
      const { error } = await supabase.from('products').upsert(payload)
      if (error) throw error
      await loadCloudSnapshot(user)
      return
    }
    setSnapshot((current) => {
      const next: Product = {
        id: product.id ?? makeId(), tenantId: user.tenantId, sku: product.sku, name: product.name,
        category: product.category ?? 'Umum', purchasePrice: product.purchasePrice ?? 0,
        sellingPrice: product.sellingPrice ?? 0, stock: product.stock ?? 0,
        minimumStock: product.minimumStock ?? 0, active: product.active ?? true, updatedAt: new Date().toISOString()
      }
      const exists = current.products.some((item) => item.id === next.id)
      return { ...current, products: exists ? current.products.map((item) => item.id === next.id ? next : item) : [next, ...current.products] }
    })
  }, [loadCloudSnapshot, user])

  const saveParty = useCallback(async (party: Partial<Party> & Pick<Party, 'name' | 'type'>) => {
    if (!user) return
    if (supabase) {
      const { error } = await supabase.from('parties').upsert({
        id: party.id, tenant_id: user.tenantId, name: party.name, type: party.type,
        phone: party.phone, email: party.email, address: party.address
      })
      if (error) throw error
      await loadCloudSnapshot(user)
      return
    }
    setSnapshot((current) => ({
      ...current,
      parties: [{ id: party.id ?? makeId(), tenantId: user.tenantId, name: party.name, type: party.type, phone: party.phone, email: party.email, address: party.address }, ...current.parties]
    }))
  }, [loadCloudSnapshot, user])

  const saveAccount = useCallback(async (draft: AccountDraft) => {
    if (!user || user.role !== 'owner') throw new Error('Hanya Owner yang dapat mengelola akun.')
    const code = draft.code.trim()
    const name = draft.name.trim()
    validateAccountInput(code, name)
    if (supabase) {
      await cloudApi.saveAccount({ ...draft, code, name })
      await loadCloudSnapshot(user)
      return
    }
    setSnapshot((current) => {
      const existing = draft.id ? current.accounts.find((item) => item.id === draft.id) : undefined
      if (existing?.systemKey) throw new Error('Akun sistem tidak dapat diubah.')
      if (!existing && current.accounts.some((item) => item.code.toLowerCase() === code.toLowerCase())) {
        throw new Error('Kode akun sudah digunakan.')
      }
      if (existing) {
        return {
          ...current,
          accounts: current.accounts.map((item) => item.id === existing.id ? { ...item, name } : item)
        }
      }
      const normalBalance = normalBalanceForCategory(draft.category)
      const account: Account = {
        id: makeId(), tenantId: user.tenantId, code, name, category: draft.category,
        normalBalance, active: true
      }
      return { ...current, accounts: [...current.accounts, account].sort((a, b) => a.code.localeCompare(b.code)) }
    })
  }, [loadCloudSnapshot, user])

  const setAccountActive = useCallback(async (accountId: string, active: boolean) => {
    if (!user || user.role !== 'owner') throw new Error('Hanya Owner yang dapat mengelola akun.')
    const account = snapshot.accounts.find((item) => item.id === accountId)
    if (!account) throw new Error('Akun tidak ditemukan.')
    if (account.systemKey) throw new Error('Akun sistem tidak dapat dinonaktifkan.')
    if (supabase) {
      await cloudApi.setAccountActive(accountId, active)
      await loadCloudSnapshot(user)
      return
    }
    setSnapshot((current) => ({
      ...current,
      accounts: current.accounts.map((item) => item.id === accountId ? { ...item, active } : item)
    }))
  }, [loadCloudSnapshot, snapshot.accounts, user])

  const deleteAccount = useCallback(async (accountId: string, targetAccountId?: string) => {
    if (!user || user.role !== 'owner') throw new Error('Hanya Owner yang dapat menghapus akun.')
    const account = snapshot.accounts.find((item) => item.id === accountId)
    if (!account) throw new Error('Akun tidak ditemukan.')
    if (account.systemKey) throw new Error('Akun sistem tidak dapat dihapus.')
    if (supabase) {
      await cloudApi.deleteAccount(accountId, targetAccountId)
      await loadCloudSnapshot(user)
      return
    }
    setSnapshot((current) => deleteOrMergeAccount(current, accountId, targetAccountId))
  }, [loadCloudSnapshot, snapshot.accounts, user])

  const syncNow = useCallback(async () => {
    if (!navigator.onLine || !user) {
      setSyncState('offline')
      return
    }
    setSyncState('syncing')
    const jobs = await offlineStore.listJobs()
    for (const job of jobs) {
      try {
        await offlineStore.putJob({ ...job, state: 'syncing', attempts: job.attempts + 1 })
        if (cloudEnabled) {
          const result = await cloudApi.syncOfflineTransaction({ job_id: job.id, job_type: job.type, payload: job.payload }) as { status: string; message?: string }
          if (result.status === 'conflict') throw new Error(result.message || 'Transaksi mengalami konflik sinkronisasi.')
        }
        await offlineStore.deleteJob(job.id)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await offlineStore.putJob({ ...job, state: 'conflict', attempts: job.attempts + 1, error: message })
        const conflict: SyncConflict = {
          id: makeId(), tenantId: user.tenantId, jobId: job.id, type: job.type, message,
          payload: job.payload, createdAt: new Date().toISOString()
        }
        setSnapshot((current) => ({ ...current, conflicts: [conflict, ...current.conflicts] }))
      }
    }
    await refreshJobs()
    if (cloudEnabled) await loadCloudSnapshot(user)
    setSyncState((await offlineStore.listJobs()).some((item) => item.state === 'conflict') ? 'conflict' : 'success')
  }, [loadCloudSnapshot, refreshJobs, user])

  useEffect(() => {
    if (navigator.onLine && pendingJobs.some((job) => job.state === 'pending')) void syncNow()
  }, [pendingJobs, syncNow])

  const retryConflict = useCallback(async (conflictId: string) => {
    const conflict = snapshot.conflicts.find((item) => item.id === conflictId)
    if (!conflict) return
    const jobs = await offlineStore.listJobs()
    const job = jobs.find((item) => item.id === conflict.jobId)
    if (job) await offlineStore.putJob({ ...job, state: 'pending', error: undefined })
    setSnapshot((current) => ({ ...current, conflicts: current.conflicts.filter((item) => item.id !== conflictId) }))
    await refreshJobs()
    await syncNow()
  }, [refreshJobs, snapshot.conflicts, syncNow])

  const discardConflict = useCallback(async (conflictId: string) => {
    const conflict = snapshot.conflicts.find((item) => item.id === conflictId)
    if (conflict) await offlineStore.deleteJob(conflict.jobId)
    setSnapshot((current) => ({ ...current, conflicts: current.conflicts.filter((item) => item.id !== conflictId) }))
    await refreshJobs()
  }, [refreshJobs, snapshot.conflicts])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      setUser({ ...demoUser, email })
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    window.location.reload()
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
  }, [])

  const changePassword = useCallback(async (newPassword: string) => {
    if (!supabase) throw new Error('Ubah password hanya tersedia saat aplikasi tersambung ke Supabase.')
    if (newPassword.length < 8) throw new Error('Password minimal 8 karakter.')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }, [])

  const metrics = useMemo(
    () => calculateMetrics(snapshot.accounts, snapshot.journals, snapshot.transactions),
    [snapshot.accounts, snapshot.journals, snapshot.transactions]
  )

  const value = useMemo<AppStoreValue>(() => ({
    user, snapshot, metrics, syncState, pendingJobs, loading, demoMode: !cloudEnabled,
    signIn, signOut, changePassword, postTransaction, settleInvoice, postManualJournal, voidTransaction,
    saveProduct, saveParty, saveAccount, setAccountActive, deleteAccount, syncNow, retryConflict, discardConflict
  }), [
    user, snapshot, metrics, syncState, pendingJobs, loading, signIn, signOut, changePassword, postTransaction,
    settleInvoice, postManualJournal, voidTransaction, saveProduct, saveParty, saveAccount,
    setAccountActive, deleteAccount, syncNow,
    retryConflict, discardConflict
  ])

  return <AppStore.Provider value={value}>{children}</AppStore.Provider>
}

export const useAppStore = () => {
  const value = useContext(AppStore)
  if (!value) throw new Error('useAppStore harus digunakan di dalam AppStoreProvider.')
  return value
}
