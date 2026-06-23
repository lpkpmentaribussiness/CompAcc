import type { ColumnDef } from '@tanstack/react-table'
import { Banknote, Download, Plus, ReceiptText } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable } from '../components/DataTable'
import { Button, Card, Field, Input, Modal, PageHeader, Select } from '../components/ui'
import { downloadCsv, formatCurrency, formatDate, makeId, today } from '../lib/format'
import { useAppStore } from '../store/AppStore'
import type { Transaction } from '../types'

export default function CashExpensesPage() {
  const { snapshot, metrics, postTransaction } = useAppStore()
  const expenses = snapshot.transactions.filter((item) => item.kind === 'expense')
  const expenseAccounts = snapshot.accounts.filter((item) =>
    item.active && item.category === 'expense' && item.systemKey !== 'cogs'
  )
  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState(expenseAccounts[0]?.id ?? '')
  const [amount, setAmount] = useState(0)
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(today())
  const [saving, setSaving] = useState(false)

  const columns = useMemo<ColumnDef<Transaction>[]>(() => [
    {
      accessorKey: 'number',
      header: 'Referensi',
      cell: ({ row }) => <div><p className="font-bold text-slate-800">{row.original.number}</p><p className="mt-0.5 text-xs text-slate-400">{formatDate(row.original.date)}</p></div>
    },
    { accessorKey: 'description', header: 'Keterangan', cell: ({ row }) => <span className="text-slate-700">{row.original.description}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.original.status === 'posted' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{row.original.status === 'posted' ? 'Terposting' : 'Dibatalkan'}</span> },
    { accessorKey: 'total', header: 'Jumlah', cell: ({ row }) => <span className="font-extrabold text-slate-900">{formatCurrency(row.original.total)}</span> }
  ], [])

  const submit = async () => {
    if (!accountId || amount <= 0 || !description.trim()) return
    setSaving(true)
    try {
      await postTransaction({
        clientRequestId: makeId(), kind: 'expense', paymentMode: 'cash', date,
        description: description.trim(), total: amount, expenseAccountId: accountId, items: []
      })
      setOpen(false)
      setAmount(0)
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
        eyebrow="Cash management"
        title="Kas & beban"
        description="Catat biaya operasional dan pantau arus kas usaha."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => downloadCsv(
                'beban-compacc.csv',
                expenses.map((item) => ({
                  Referensi: item.number,
                  Tanggal: item.date,
                  Keterangan: item.description,
                  Jumlah: item.total
                }))
              )}
            >
              <Download size={17} /> Ekspor
            </Button>
            <Button onClick={() => setOpen(true)}><Plus size={17} /> Catat beban</Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700 w-fit"><Banknote size={20} /></div>
          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Saldo kas & bank</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-950">{formatCurrency(metrics.cash)}</p>
        </Card>
        <Card className="p-5">
          <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700 w-fit"><ReceiptText size={20} /></div>
          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Beban operasional</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-950">{formatCurrency(metrics.expenses)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Transaksi beban</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-950">{expenses.length}</p>
          <p className="mt-2 text-xs text-slate-400">seluruh periode</p>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <DataTable data={expenses} columns={columns} searchPlaceholder="Cari referensi atau keterangan..." />
      </Card>
      <Modal
        open={open}
        title="Catat pembayaran beban"
        description="Beban akan didebit dan Kas & Bank dikredit secara otomatis."
        onClose={() => setOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? 'Memproses...' : 'Posting beban'}</Button></>}
      >
        <div className="space-y-4">
          <Field label="Tanggal"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
          <Field label="Akun beban">
            <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              {expenseAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
            </Select>
          </Field>
          <Field label="Nominal"><Input type="number" min="1" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></Field>
          <Field label="Keterangan"><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Contoh: Pembayaran listrik bulan Juni" /></Field>
        </div>
      </Modal>
    </div>
  )
}
