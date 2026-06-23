import type { ColumnDef } from '@tanstack/react-table'
import { CalendarClock, CheckCircle2, Download, HandCoins } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable } from '../components/DataTable'
import { Badge, Button, Card, Field, Input, Modal, PageHeader } from '../components/ui'
import { downloadCsv, formatCurrency, formatDate } from '../lib/format'
import { useAppStore } from '../store/AppStore'
import type { Transaction } from '../types'

const statusLabel = {
  unpaid: ['Belum bayar', 'warning'],
  partial: ['Sebagian', 'info'],
  paid: ['Lunas', 'success'],
  overdue: ['Jatuh tempo', 'danger']
} as const

export default function InvoicesPage({ type }: { type: 'receivable' | 'payable' }) {
  const { snapshot, settleInvoice } = useAppStore()
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const isReceivable = type === 'receivable'
  const transactions = snapshot.transactions.filter((item) =>
    item.kind === (isReceivable ? 'sale' : 'purchase') && item.paymentMode === 'credit'
  )
  const openInvoices = transactions.filter((item) => item.remainingAmount > 0 && item.status === 'posted')
  const total = openInvoices.reduce((sum, item) => sum + item.remainingAmount, 0)
  const overdue = openInvoices.filter((item) => item.invoiceStatus === 'overdue')

  const openPayment = (transaction: Transaction) => {
    setSelected(transaction)
    setAmount(transaction.remainingAmount)
    setNote('')
  }

  const columns = useMemo<ColumnDef<Transaction>[]>(() => [
    {
      accessorKey: 'number',
      header: 'Invoice',
      cell: ({ row }) => (
        <div>
          <p className="font-bold text-slate-800">{row.original.number}</p>
          <p className="mt-0.5 text-xs text-slate-400">{formatDate(row.original.date)}</p>
        </div>
      )
    },
    {
      accessorKey: 'partyName',
      header: isReceivable ? 'Pelanggan' : 'Vendor',
      cell: ({ row }) => <span className="font-semibold text-slate-700">{row.original.partyName || '—'}</span>
    },
    {
      accessorKey: 'dueDate',
      header: 'Jatuh tempo',
      cell: ({ row }) => <span className={row.original.invoiceStatus === 'overdue' ? 'font-bold text-red-600' : 'text-slate-600'}>{formatDate(row.original.dueDate)}</span>
    },
    {
      accessorKey: 'invoiceStatus',
      header: 'Status',
      cell: ({ row }) => {
        const config = statusLabel[row.original.invoiceStatus ?? 'unpaid']
        return <Badge tone={config[1]}>{config[0]}</Badge>
      }
    },
    {
      accessorKey: 'remainingAmount',
      header: 'Sisa',
      cell: ({ row }) => <span className="font-extrabold text-slate-900">{formatCurrency(row.original.remainingAmount)}</span>
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => row.original.remainingAmount > 0 && row.original.status === 'posted' ? (
        <Button size="sm" variant="secondary" onClick={() => openPayment(row.original)}><HandCoins size={15} /> Bayar</Button>
      ) : <CheckCircle2 className="text-emerald-500" size={18} />
    }
  ], [isReceivable])

  const submit = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await settleInvoice(selected.id, amount, note)
      setSelected(null)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <PageHeader
        eyebrow="Accounts"
        title={isReceivable ? 'Piutang pelanggan' : 'Utang vendor'}
        description={isReceivable
          ? 'Pantau invoice penjualan kredit, cicilan, dan penerimaan kas.'
          : 'Kelola kewajiban usaha, jatuh tempo, dan riwayat pembayaran vendor.'}
        actions={<Button variant="secondary" onClick={() => downloadCsv(`${type}-compacc.csv`, transactions.map((item) => ({
          Invoice: item.number, Pihak: item.partyName, Tanggal: item.date, 'Jatuh Tempo': item.dueDate,
          Total: item.total, Dibayar: item.paidAmount, Sisa: item.remainingAmount, Status: item.invoiceStatus
        })))}><Download size={17} /> Ekspor</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Total berjalan</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-950">{formatCurrency(total)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Invoice aktif</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-950">{openInvoices.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Lewat jatuh tempo</p>
          <p className="mt-2 text-2xl font-extrabold text-red-600">{formatCurrency(overdue.reduce((sum, item) => sum + item.remainingAmount, 0))}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <DataTable data={transactions} columns={columns} searchPlaceholder={`Cari invoice atau ${isReceivable ? 'pelanggan' : 'vendor'}...`} />
      </Card>

      <Modal
        open={Boolean(selected)}
        title={isReceivable ? 'Terima pembayaran' : 'Bayar tagihan'}
        description={`${selected?.number ?? ''} · ${selected?.partyName ?? ''}`}
        onClose={() => setSelected(null)}
        footer={<><Button variant="secondary" onClick={() => setSelected(null)}>Batal</Button><Button onClick={() => void submit()} disabled={saving || amount <= 0 || amount > (selected?.remainingAmount ?? 0)}>{saving ? 'Memproses...' : 'Posting pembayaran'}</Button></>}
      >
        <div className="mb-5 rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Sisa tagihan</span>
            <strong className="text-lg text-slate-900">{formatCurrency(selected?.remainingAmount ?? 0)}</strong>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <CalendarClock size={15} /> Jatuh tempo {formatDate(selected?.dueDate)}
          </div>
        </div>
        <div className="space-y-4">
          <Field label="Nominal pembayaran" hint="Pembayaran sebagian diperbolehkan.">
            <Input type="number" min="1" max={selected?.remainingAmount} value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
          </Field>
          <Field label="Catatan">
            <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Transfer bank, nomor bukti, atau catatan lain" />
          </Field>
          {amount > (selected?.remainingAmount ?? 0) && <p className="text-xs font-bold text-red-600">Nominal melebihi sisa tagihan.</p>}
        </div>
      </Modal>
    </div>
  )
}
