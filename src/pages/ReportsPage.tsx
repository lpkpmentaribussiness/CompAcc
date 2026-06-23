import { Download, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Card, PageHeader } from '../components/ui'
import { calculateAccountBalances } from '../lib/accounting'
import { downloadCsv, formatCurrency } from '../lib/format'
import { useAppStore } from '../store/AppStore'

const reports = [
  ['profit-loss', 'Laba rugi'],
  ['balance-sheet', 'Neraca'],
  ['trial-balance', 'Neraca saldo'],
  ['ledger', 'Buku besar'],
  ['stock', 'Posisi stok'],
  ['aging', 'Umur piutang & utang']
] as const

export default function ReportsPage() {
  const { snapshot, metrics } = useAppStore()
  const [active, setActive] = useState<(typeof reports)[number][0]>('profit-loss')
  const balances = useMemo(() => calculateAccountBalances(snapshot.accounts, snapshot.journals), [snapshot.accounts, snapshot.journals])

  const rows = useMemo(() => {
    if (active === 'profit-loss') {
      return balances.filter((item) => ['revenue', 'expense'].includes(item.account.category)).map((item) => ({
        Kode: item.account.code, Akun: item.account.name, Kategori: item.account.category, Saldo: item.balance
      }))
    }
    if (active === 'balance-sheet') {
      return balances.filter((item) => ['asset', 'liability', 'equity'].includes(item.account.category)).map((item) => ({
        Kode: item.account.code, Akun: item.account.name, Kategori: item.account.category, Saldo: item.balance
      }))
    }
    if (active === 'stock') {
      return snapshot.products.map((item) => ({
        SKU: item.sku, Produk: item.name, Stok: item.stock, 'Harga Modal': item.purchasePrice, Nilai: item.stock * item.purchasePrice
      }))
    }
    if (active === 'aging') {
      return snapshot.transactions.filter((item) => item.paymentMode === 'credit').map((item) => ({
        Invoice: item.number, Pihak: item.partyName, Jenis: item.kind, 'Jatuh Tempo': item.dueDate,
        Total: item.total, Sisa: item.remainingAmount, Status: item.invoiceStatus
      }))
    }
    return balances.map((item) => ({
      Kode: item.account.code, Akun: item.account.name, Debit: item.debit, Kredit: item.credit, Saldo: item.balance
    }))
  }, [active, balances, snapshot.products, snapshot.transactions])

  const renderSummary = () => {
    if (active === 'profit-loss') {
      return (
        <div className="grid gap-4 sm:grid-cols-3">
          <Summary label="Pendapatan" value={metrics.revenue} tone="text-emerald-600" />
          <Summary label="Beban + HPP" value={metrics.expenses + metrics.cogs} tone="text-red-600" />
          <Summary label="Laba bersih" value={metrics.profit} tone="text-brand-700" />
        </div>
      )
    }
    if (active === 'balance-sheet') {
      const assets = balances.filter((item) => item.account.category === 'asset').reduce((sum, item) => sum + item.balance, 0)
      const liabilities = balances.filter((item) => item.account.category === 'liability').reduce((sum, item) => sum + item.balance, 0)
      const equity = balances.filter((item) => item.account.category === 'equity').reduce((sum, item) => sum + item.balance, 0) + metrics.profit
      return (
        <div className="grid gap-4 sm:grid-cols-3">
          <Summary label="Total aset" value={assets} />
          <Summary label="Total liabilitas" value={liabilities} />
          <Summary label="Ekuitas + laba" value={equity} />
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <PageHeader
        eyebrow="Financial reporting"
        title="Laporan"
        description="Laporan selalu dihitung dari jurnal terposting sebagai sumber kebenaran."
        actions={
          <>
            <Button variant="secondary" onClick={() => window.print()}><Printer size={17} /> Cetak</Button>
            <Button onClick={() => downloadCsv(`${active}-compacc.csv`, rows)}><Download size={17} /> Ekspor CSV</Button>
          </>
        }
      />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {reports.map(([key, label]) => (
          <button key={key} onClick={() => setActive(key)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold ${active === key ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{label}</button>
        ))}
      </div>
      {renderSummary()}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="font-extrabold text-slate-900">{reports.find(([key]) => key === active)?.[1]}</h2>
            <p className="mt-1 text-xs text-slate-500">Periode berjalan · Basis akrual</p>
          </div>
          <Badge tone="success">Jurnal terposting</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>{rows.length > 0 && Object.keys(rows[0]).map((key) => <th key={key} className="px-5 py-3 font-bold">{key}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  {Object.values(row).map((value, cell) => (
                    <td key={cell} className="px-5 py-4 text-slate-700">
                      {typeof value === 'number' && (Object.keys(row)[cell].toLowerCase().includes('saldo') || Object.keys(row)[cell].toLowerCase().includes('debit') || Object.keys(row)[cell].toLowerCase().includes('kredit') || Object.keys(row)[cell].toLowerCase().includes('nilai') || Object.keys(row)[cell].toLowerCase().includes('total') || Object.keys(row)[cell].toLowerCase().includes('sisa'))
                        ? <strong className="text-slate-900">{formatCurrency(value)}</strong>
                        : String(value ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Summary({ label, value, tone = 'text-slate-950' }: { label: string; value: number; tone?: string }) {
  return <Card className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-2 text-2xl font-extrabold ${tone}`}>{formatCurrency(value)}</p></Card>
}
