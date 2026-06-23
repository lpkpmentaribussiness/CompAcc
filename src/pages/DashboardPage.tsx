import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  PackagePlus,
  ShoppingCart,
  TrendingUp,
  WalletCards
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { Card, PageHeader } from '../components/ui'
import { formatCurrency, formatDate } from '../lib/format'
import { useAppStore } from '../store/AppStore'

const metricCards = [
  { key: 'cash', label: 'Kas & bank', icon: Banknote, tone: 'bg-indigo-50 text-indigo-700', change: '+8,4%' },
  { key: 'revenue', label: 'Pendapatan', icon: TrendingUp, tone: 'bg-emerald-50 text-emerald-700', change: '+12,7%' },
  { key: 'profit', label: 'Laba bersih', icon: CircleDollarSign, tone: 'bg-violet-50 text-violet-700', change: '+6,2%' },
  { key: 'inventory', label: 'Nilai persediaan', icon: Boxes, tone: 'bg-amber-50 text-amber-700', change: '-2,1%' }
] as const

export default function DashboardPage() {
  const { metrics, snapshot, user } = useAppStore()
  const lowStock = snapshot.products.filter((product) => product.stock <= product.minimumStock)
  const overdue = snapshot.transactions.filter((transaction) => transaction.invoiceStatus === 'overdue')
  const recent = snapshot.transactions.slice(0, 5)
  const chartData = [
    { day: 'Sen', revenue: 820000, expense: 390000 },
    { day: 'Sel', revenue: 1050000, expense: 470000 },
    { day: 'Rab', revenue: 960000, expense: 420000 },
    { day: 'Kam', revenue: 1380000, expense: 610000 },
    { day: 'Jum', revenue: 1620000, expense: 690000 },
    { day: 'Sab', revenue: 1880000, expense: 740000 },
    { day: 'Min', revenue: 1240000, expense: 530000 }
  ]

  return (
    <div className="space-y-7 pb-24 lg:pb-0">
      <PageHeader
        eyebrow="Workspace keuangan"
        title={`Selamat datang, ${user?.fullName.split(' ')[0] ?? 'Owner'}`}
        description="Pantau kesehatan usaha, tagihan, dan aktivitas operasional dari satu tempat."
        actions={
          <>
            <Link to="/pembelian" className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <PackagePlus size={17} /> Restock
            </Link>
            <Link to="/penjualan" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-bold text-white shadow-sm hover:bg-brand-800">
              <ShoppingCart size={17} /> Transaksi baru
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = card.icon
          const value = metrics[card.key]
          const positive = !card.change.startsWith('-')
          return (
            <Card key={card.key} className="p-5">
              <div className="flex items-start justify-between">
                <div className={`rounded-xl p-2.5 ${card.tone}`}><Icon size={20} /></div>
                <span className={`flex items-center gap-1 text-xs font-bold ${positive ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {card.change}
                </span>
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">{card.label}</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">{formatCurrency(value)}</p>
              <p className="mt-2 text-xs text-slate-400">dibanding periode sebelumnya</p>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-5 sm:p-6">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Arus pendapatan</h2>
              <p className="mt-1 text-xs text-slate-500">Pendapatan dan pengeluaran 7 hari terakhir</p>
            </div>
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
              <option>7 hari</option>
              <option>30 hari</option>
              <option>Tahun ini</option>
            </select>
          </div>
          <div className="h-72 min-h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
              <AreaChart data={chartData} margin={{ left: -18, right: 8 }}>
                <defs>
                  <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(value) => `${value / 1000000} jt`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ borderRadius: 14, borderColor: '#e2e8f0' }} />
                <Area type="monotone" dataKey="revenue" name="Pendapatan" stroke="#4f46e5" strokeWidth={3} fill="url(#revenue)" />
                <Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="#f59e0b" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <h2 className="text-base font-extrabold text-slate-900">Perlu perhatian</h2>
            <p className="mt-1 text-xs text-slate-500">Prioritas operasional hari ini</p>
          </div>
          <div className="divide-y divide-slate-100">
            <Link to="/utang" className="flex items-center gap-4 p-5 transition hover:bg-slate-50">
              <div className="rounded-xl bg-red-50 p-2.5 text-red-600"><Clock3 size={19} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">{overdue.length} tagihan jatuh tempo</p>
                <p className="mt-0.5 text-xs text-slate-500">{formatCurrency(metrics.overdue)} perlu diselesaikan</p>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </Link>
            <Link to="/produk" className="flex items-center gap-4 p-5 transition hover:bg-slate-50">
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600"><AlertTriangle size={19} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">{lowStock.length} produk stok menipis</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{lowStock.map((product) => product.name).join(', ') || 'Semua stok aman'}</p>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </Link>
            <Link to="/piutang" className="flex items-center gap-4 p-5 transition hover:bg-slate-50">
              <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><WalletCards size={19} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">Piutang berjalan</p>
                <p className="mt-0.5 text-xs text-slate-500">{formatCurrency(metrics.receivables)} belum diterima</p>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </Link>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:px-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Aktivitas terbaru</h2>
            <p className="mt-1 text-xs text-slate-500">Transaksi yang baru diposting</p>
          </div>
          <Link to="/akuntansi" className="text-xs font-bold text-brand-700 hover:text-brand-900">Lihat jurnal</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-6 py-3 font-bold">Transaksi</th>
                <th className="px-4 py-3 font-bold">Tanggal</th>
                <th className="px-4 py-3 font-bold">Pihak</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-6 py-3 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-800">{transaction.number}</p>
                    <p className="mt-0.5 text-xs capitalize text-slate-400">{transaction.kind} · {transaction.description}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{formatDate(transaction.date)}</td>
                  <td className="px-4 py-4 text-slate-600">{transaction.partyName || 'Retail'}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${transaction.status === 'voided' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {transaction.status === 'voided' ? 'Dibatalkan' : 'Terposting'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-extrabold text-slate-900">{formatCurrency(transaction.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
