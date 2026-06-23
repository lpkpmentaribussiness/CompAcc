import type { ColumnDef } from '@tanstack/react-table'
import { BookPlus, LockKeyhole, Pencil, Plus, Power, RotateCcw, Scale, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { DataTable } from '../components/DataTable'
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select } from '../components/ui'
import { calculateAccountBalances } from '../lib/accounting'
import { getAccountUsage } from '../lib/accounts'
import { formatCurrency, formatDate, today } from '../lib/format'
import { useAppStore } from '../store/AppStore'
import type { Account, AccountDraft, JournalEntry, JournalLine, Transaction } from '../types'

const categoryLabels: Record<Account['category'], string> = {
  asset: 'Aset',
  liability: 'Liabilitas',
  equity: 'Ekuitas',
  revenue: 'Pendapatan',
  expense: 'Beban'
}

export default function AccountingPage() {
  const {
    snapshot,
    postManualJournal,
    voidTransaction,
    saveAccount,
    setAccountActive,
    deleteAccount
  } = useAppStore()
  const [section, setSection] = useState<'accounts' | 'transactions' | 'journals'>('accounts')
  const [journalOpen, setJournalOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountSaving, setAccountSaving] = useState(false)
  const [accountDeleting, setAccountDeleting] = useState(false)
  const [mergeAccount, setMergeAccount] = useState<Account | null>(null)
  const [targetAccountId, setTargetAccountId] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | Account['category']>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [accountForm, setAccountForm] = useState<AccountDraft>({ code: '', name: '', category: 'asset' })
  const [date, setDate] = useState(today())
  const [description, setDescription] = useState('')
  const activeAccounts = snapshot.accounts.filter((account) => account.active)
  const [lines, setLines] = useState<Array<{ accountId: string; debit: number; credit: number }>>([
    { accountId: activeAccounts[0]?.id ?? '', debit: 0, credit: 0 },
    { accountId: activeAccounts[1]?.id ?? '', debit: 0, credit: 0 }
  ])
  const [saving, setSaving] = useState(false)
  const debit = lines.reduce((sum, item) => sum + item.debit, 0)
  const credit = lines.reduce((sum, item) => sum + item.credit, 0)
  const balanced = debit > 0 && Math.abs(debit - credit) < 0.005
  const accountBalances = useMemo(
    () => calculateAccountBalances(snapshot.accounts, snapshot.journals),
    [snapshot.accounts, snapshot.journals]
  )
  const filteredAccounts = useMemo(() => accountBalances.filter(({ account }) =>
    (categoryFilter === 'all' || account.category === categoryFilter) &&
    (statusFilter === 'all' || (statusFilter === 'active' ? account.active : !account.active))
  ), [accountBalances, categoryFilter, statusFilter])

  const openAccount = useCallback((account?: Account) => {
    setAccountForm(account
      ? { id: account.id, code: account.code, name: account.name, category: account.category }
      : { code: '', name: '', category: 'asset' })
    setAccountOpen(true)
  }, [])

  const submitAccount = async () => {
    setAccountSaving(true)
    try {
      await saveAccount(accountForm)
      setAccountOpen(false)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    } finally {
      setAccountSaving(false)
    }
  }

  const toggleAccount = useCallback(async (account: Account) => {
    const action = account.active ? 'menonaktifkan' : 'mengaktifkan'
    if (!window.confirm(`Yakin ingin ${action} akun ${account.code} · ${account.name}?`)) return
    try {
      await setAccountActive(account.id, !account.active)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    }
  }, [setAccountActive])

  const requestDeleteAccount = useCallback(async (account: Account) => {
    const usage = getAccountUsage(snapshot, account.id)
    if (usage.journalLines + usage.payments === 0) {
      if (!window.confirm(`Hapus permanen akun ${account.code} · ${account.name}? Tindakan ini tidak dapat dibatalkan.`)) return
      setAccountDeleting(true)
      try {
        await deleteAccount(account.id)
      } catch (error) {
        window.alert(error instanceof Error ? error.message : String(error))
      } finally {
        setAccountDeleting(false)
      }
      return
    }

    const target = snapshot.accounts.find((candidate) =>
      candidate.id !== account.id &&
      candidate.active &&
      candidate.category === account.category
    )
    setMergeAccount(account)
    setTargetAccountId(target?.id ?? '')
  }, [deleteAccount, snapshot])

  const submitMergeAccount = async () => {
    if (!mergeAccount || !targetAccountId) return
    setAccountDeleting(true)
    try {
      await deleteAccount(mergeAccount.id, targetAccountId)
      setMergeAccount(null)
      setTargetAccountId('')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    } finally {
      setAccountDeleting(false)
    }
  }

  const accountColumns = useMemo<ColumnDef<(typeof accountBalances)[number]>[]>(() => [
    {
      accessorFn: (row) => `${row.account.code} ${row.account.name}`,
      header: 'Akun',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className={`grid h-9 w-9 place-items-center rounded-xl text-xs font-extrabold ${row.original.account.systemKey ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
            {row.original.account.systemKey ? <LockKeyhole size={16} /> : row.original.account.code.slice(0, 2)}
          </div>
          <div>
            <p className="font-bold text-slate-800">{row.original.account.code} · {row.original.account.name}</p>
            <p className="mt-0.5 text-xs text-slate-400">{row.original.account.systemKey ? 'Akun inti sistem' : 'Akun tambahan'}</p>
          </div>
        </div>
      )
    },
    {
      accessorFn: (row) => row.account.category,
      header: 'Kategori',
      cell: ({ row }) => <Badge tone="neutral">{categoryLabels[row.original.account.category]}</Badge>
    },
    {
      accessorFn: (row) => row.account.normalBalance,
      header: 'Normal',
      cell: ({ row }) => <span className="text-slate-600">{row.original.account.normalBalance === 'debit' ? 'Debit' : 'Kredit'}</span>
    },
    {
      accessorFn: (row) => row.balance,
      header: 'Saldo',
      cell: ({ row }) => <strong className={row.original.balance < 0 ? 'text-red-600' : 'text-slate-900'}>{formatCurrency(row.original.balance)}</strong>
    },
    {
      accessorFn: (row) => row.account.active,
      header: 'Status',
      cell: ({ row }) => <Badge tone={row.original.account.active ? 'success' : 'neutral'}>{row.original.account.active ? 'Aktif' : 'Nonaktif'}</Badge>
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const account = row.original.account
        if (account.systemKey) return <span className="text-xs font-semibold text-slate-400">Dilindungi</span>
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => openAccount(account)}><Pencil size={15} /> Edit</Button>
            <Button
              variant="ghost"
              size="sm"
              className={account.active ? 'text-amber-600' : 'text-emerald-600'}
              onClick={() => void toggleAccount(account)}
            >
              <Power size={15} /> {account.active ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600"
              disabled={accountDeleting}
              onClick={() => void requestDeleteAccount(account)}
            >
              <Trash2 size={15} /> Hapus
            </Button>
          </div>
        )
      }
    }
  ], [accountDeleting, openAccount, requestDeleteAccount, toggleAccount])

  const transactionColumns = useMemo<ColumnDef<Transaction>[]>(() => [
    {
      accessorKey: 'number',
      header: 'Transaksi',
      cell: ({ row }) => <div><p className="font-bold text-slate-800">{row.original.number}</p><p className="mt-0.5 text-xs capitalize text-slate-400">{row.original.kind}</p></div>
    },
    { accessorKey: 'date', header: 'Tanggal', cell: ({ row }) => formatDate(row.original.date) },
    { accessorKey: 'description', header: 'Keterangan' },
    { accessorKey: 'total', header: 'Total', cell: ({ row }) => <strong>{formatCurrency(row.original.total)}</strong> },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge tone={row.original.status === 'posted' ? 'success' : 'danger'}>{row.original.status === 'posted' ? 'Terposting' : 'Dibatalkan'}</Badge>
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => row.original.status === 'posted' && row.original.kind !== 'void' ? (
        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => {
          if (window.confirm(`Batalkan ${row.original.number}? Jurnal balik akan dibuat.`)) void voidTransaction(row.original.id)
        }}><RotateCcw size={15} /> Batalkan</Button>
      ) : null
    }
  ], [voidTransaction])

  const journalColumns = useMemo<ColumnDef<JournalEntry>[]>(() => [
    {
      accessorKey: 'number',
      header: 'Jurnal',
      cell: ({ row }) => <div><p className="font-bold text-slate-800">{row.original.number}</p><p className="mt-0.5 text-xs capitalize text-slate-400">{row.original.source}</p></div>
    },
    { accessorKey: 'date', header: 'Tanggal', cell: ({ row }) => formatDate(row.original.date) },
    { accessorKey: 'description', header: 'Keterangan' },
    {
      id: 'debit',
      header: 'Total debit',
      cell: ({ row }) => <strong>{formatCurrency(row.original.lines.reduce((sum, item) => sum + item.debit, 0))}</strong>
    },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge tone={row.original.status === 'posted' ? 'success' : 'danger'}>{row.original.status}</Badge> }
  ], [])

  const updateLine = (index: number, patch: Partial<{ accountId: string; debit: number; credit: number }>) => {
    setLines((current) => current.map((item, lineIndex) => lineIndex === index ? { ...item, ...patch } : item))
  }

  const submitJournal = async () => {
    if (!balanced || !description.trim()) return
    const journalLines: JournalLine[] = lines.map((item) => {
      const account = activeAccounts.find((candidate) => candidate.id === item.accountId)
      if (!account) throw new Error('Akun jurnal tidak aktif atau tidak ditemukan.')
      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        debit: item.debit,
        credit: item.credit
      }
    })
    setSaving(true)
    try {
      await postManualJournal(date, description.trim(), journalLines)
      setJournalOpen(false)
      setDescription('')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <PageHeader
        eyebrow="General ledger"
        title="Akuntansi"
        description="Kelola daftar akun, audit transaksi, dan posting jurnal penyesuaian."
        actions={
          <>
            <Button variant="secondary" onClick={() => openAccount()}><Plus size={17} /> Akun baru</Button>
            <Button onClick={() => setJournalOpen(true)}><BookPlus size={17} /> Jurnal manual</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Akun aktif</p>
          <p className="mt-2 text-3xl font-extrabold">{activeAccounts.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Jurnal terposting</p>
          <p className="mt-2 text-3xl font-extrabold">{snapshot.journals.filter((item) => item.status === 'posted').length}</p>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><Scale size={22} /></div>
          <div><p className="font-extrabold text-slate-900">Double-entry aktif</p><p className="mt-1 text-xs text-slate-500">Semua posting wajib seimbang.</p></div>
        </Card>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          ['accounts', 'Daftar akun'],
          ['transactions', 'Riwayat transaksi'],
          ['journals', 'Buku jurnal']
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSection(key as typeof section)}
            className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold ${section === key ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'accounts' && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="font-extrabold text-slate-900">Daftar akun buku besar</h2>
              <p className="mt-1 text-xs text-slate-500">Akun nonaktif tetap dipertahankan untuk laporan historis.</p>
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)} className="w-40">
                <option value="all">Semua kategori</option>
                {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="w-36">
                <option value="all">Semua status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </Select>
            </div>
          </div>
          <DataTable data={filteredAccounts} columns={accountColumns} searchPlaceholder="Cari kode atau nama akun..." />
        </Card>
      )}
      {section === 'transactions' && (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-extrabold text-slate-900">Riwayat transaksi</h2></div>
          <DataTable data={snapshot.transactions} columns={transactionColumns} searchPlaceholder="Cari transaksi atau keterangan..." />
        </Card>
      )}
      {section === 'journals' && (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-extrabold text-slate-900">Buku jurnal</h2></div>
          <DataTable data={snapshot.journals} columns={journalColumns} searchPlaceholder="Cari nomor jurnal..." />
        </Card>
      )}

      <Modal
        open={accountOpen}
        title={accountForm.id ? 'Edit nama akun' : 'Tambah akun buku besar'}
        description={accountForm.id ? 'Kode dan kategori akun tidak dapat diubah setelah dibuat.' : 'Normal balance ditentukan otomatis berdasarkan kategori.'}
        onClose={() => setAccountOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAccountOpen(false)}>Batal</Button>
            <Button onClick={() => void submitAccount()} disabled={accountSaving || !accountForm.code.trim() || !accountForm.name.trim()}>
              {accountSaving ? 'Menyimpan...' : 'Simpan akun'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Kode akun" hint="Huruf, angka, titik, garis bawah, dan tanda minus. Maksimal 20 karakter.">
            <Input
              value={accountForm.code}
              readOnly={Boolean(accountForm.id)}
              maxLength={20}
              onChange={(event) => setAccountForm({ ...accountForm, code: event.target.value })}
              placeholder="Contoh: 5110"
            />
          </Field>
          <Field label="Nama akun">
            <Input
              value={accountForm.name}
              maxLength={120}
              onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })}
              placeholder="Contoh: Beban Perlengkapan"
            />
          </Field>
          <Field label="Kategori" hint={`Normal balance: ${['asset', 'expense'].includes(accountForm.category) ? 'Debit' : 'Kredit'}`}>
            <Select
              value={accountForm.category}
              disabled={Boolean(accountForm.id)}
              onChange={(event) => setAccountForm({ ...accountForm, category: event.target.value as Account['category'] })}
            >
              {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={journalOpen}
        title="Posting jurnal manual"
        description="Jurnal tidak dapat diedit setelah diposting. Koreksi dilakukan melalui pembalikan."
        onClose={() => setJournalOpen(false)}
        wide
        footer={<><Button variant="secondary" onClick={() => setJournalOpen(false)}>Batal</Button><Button onClick={() => void submitJournal()} disabled={!balanced || saving}>{saving ? 'Memposting...' : 'Posting jurnal'}</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <Field label="Tanggal"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
          <Field label="Keterangan"><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Penyesuaian atau koreksi periode" /></Field>
        </div>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[650px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="px-4 py-3">Akun</th><th className="px-4 py-3">Debit</th><th className="px-4 py-3">Kredit</th><th className="w-16" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((item, index) => (
                <tr key={index}>
                  <td className="p-3">
                    <Select value={item.accountId} onChange={(event) => updateLine(index, { accountId: event.target.value })}>
                      {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
                    </Select>
                  </td>
                  <td className="p-3"><Input type="number" min="0" value={item.debit} onChange={(event) => updateLine(index, { debit: Number(event.target.value), credit: Number(event.target.value) > 0 ? 0 : item.credit })} /></td>
                  <td className="p-3"><Input type="number" min="0" value={item.credit} onChange={(event) => updateLine(index, { credit: Number(event.target.value), debit: Number(event.target.value) > 0 ? 0 : item.debit })} /></td>
                  <td className="p-3"><button className="text-red-400" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" size="sm" onClick={() => setLines((current) => [...current, { accountId: activeAccounts[0]?.id ?? '', debit: 0, credit: 0 }])}>Tambah baris</Button>
          <div className="flex gap-6 rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <span>Debit <strong>{formatCurrency(debit)}</strong></span>
            <span>Kredit <strong>{formatCurrency(credit)}</strong></span>
            <Badge tone={balanced ? 'success' : 'danger'}>{balanced ? 'Seimbang' : 'Belum seimbang'}</Badge>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(mergeAccount)}
        title="Gabungkan dan hapus akun"
        description="Akun ini sudah memiliki riwayat dan harus dialihkan sebelum dihapus."
        onClose={() => {
          if (accountDeleting) return
          setMergeAccount(null)
          setTargetAccountId('')
        }}
        footer={(
          <>
            <Button
              variant="secondary"
              disabled={accountDeleting}
              onClick={() => {
                setMergeAccount(null)
                setTargetAccountId('')
              }}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              disabled={accountDeleting || !targetAccountId}
              onClick={() => void submitMergeAccount()}
            >
              <Trash2 size={16} /> {accountDeleting ? 'Mengalihkan...' : 'Alihkan dan hapus'}
            </Button>
          </>
        )}
      >
        {mergeAccount && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-red-500">Akun yang akan dihapus</p>
              <p className="mt-1 font-extrabold text-red-900">{mergeAccount.code} · {mergeAccount.name}</p>
              <p className="mt-2 text-sm leading-6 text-red-700">
                Seluruh jurnal dan pembayaran lama akan memakai akun tujuan. Nilai debit, kredit, dan pembayaran tidak berubah.
              </p>
            </div>
            <Field label="Alihkan ke akun">
              <Select value={targetAccountId} onChange={(event) => setTargetAccountId(event.target.value)}>
                <option value="">Pilih akun tujuan</option>
                {snapshot.accounts
                  .filter((account) =>
                    account.id !== mergeAccount.id &&
                    account.active &&
                    account.category === mergeAccount.category
                  )
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} · {account.name}{account.systemKey ? ' (akun sistem)' : ''}
                    </option>
                  ))}
              </Select>
            </Field>
            {!snapshot.accounts.some((account) =>
              account.id !== mergeAccount.id &&
              account.active &&
              account.category === mergeAccount.category
            ) && (
              <div className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">
                Belum ada akun aktif dengan kategori {categoryLabels[mergeAccount.category]}. Buat atau aktifkan akun tujuan terlebih dahulu.
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
