import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Minus,
  PackageSearch,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Trash2,
  UserRound
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Card, Input, Modal, PageHeader, Select } from '../components/ui'
import { formatCurrency, makeId, today } from '../lib/format'
import { useAppStore } from '../store/AppStore'
import type { PaymentMode, Product, Transaction, TransactionItem } from '../types'

interface CartItem extends TransactionItem {
  product: Product
}

export default function CommercePage({ kind }: { kind: 'sale' | 'purchase' }) {
  const { snapshot, postTransaction, syncState, user } = useAppStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Semua')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash')
  const [partyId, setPartyId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [invoice, setInvoice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState<Transaction | null>(null)
  const isSale = kind === 'sale'
  const parties = snapshot.parties.filter((party) => party.type === (isSale ? 'customer' : 'vendor') || party.type === 'both')
  const categories = ['Semua', ...new Set(snapshot.products.map((product) => product.category))]
  const filtered = snapshot.products.filter((product) => {
    const matchesSearch = `${product.sku} ${product.name}`.toLowerCase().includes(search.toLowerCase())
    return product.active && matchesSearch && (category === 'Semua' || product.category === category)
  })
  const total = cart.reduce((sum, item) => sum + item.subtotal, 0)

  const updateQuantity = (product: Product, delta: number) => {
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id)
      if (!existing && delta > 0) {
        const price = isSale ? product.sellingPrice : product.purchasePrice
        return [...current, {
          product, productId: product.id, sku: product.sku, name: product.name, quantity: 1,
          unitPrice: price, unitCost: product.purchasePrice, subtotal: price
        }]
      }
      return current
        .map((item) => {
          if (item.productId !== product.id) return item
          const quantity = Math.max(0, item.quantity + delta)
          return { ...item, quantity, subtotal: quantity * item.unitPrice }
        })
        .filter((item) => item.quantity > 0)
    })
  }

  const setPrice = (productId: string, value: number) => {
    setCart((current) => current.map((item) => item.productId === productId ? {
      ...item, unitPrice: Math.max(0, value), subtotal: item.quantity * Math.max(0, value)
    } : item))
  }

  const clear = () => {
    setCart([])
    setPartyId('')
    setDueDate('')
    setInvoice('')
    setPaymentMode('cash')
  }

  const submit = async () => {
    if (!cart.length) return
    if (paymentMode === 'credit' && (!partyId || !dueDate)) return
    if (isSale) {
      const insufficient = cart.find((item) => item.quantity > item.product.stock)
      if (insufficient) {
        window.alert(`Stok ${insufficient.name} hanya ${insufficient.product.stock}.`)
        return
      }
    }
    setSubmitting(true)
    try {
      const party = parties.find((item) => item.id === partyId)
      const transaction = await postTransaction({
        clientRequestId: makeId(),
        kind,
        paymentMode,
        date: today(),
        dueDate: paymentMode === 'credit' ? dueDate : undefined,
        partyId: paymentMode === 'credit' ? partyId : undefined,
        partyName: paymentMode === 'credit' ? party?.name : undefined,
        description: invoice.trim() || `${isSale ? 'Penjualan' : 'Pembelian'} ${paymentMode === 'cash' ? 'tunai' : 'kredit'}`,
        total,
        items: cart.map((item) => ({
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost,
          subtotal: item.subtotal
        }))
      })
      setReceipt(transaction)
      clear()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    } finally {
      setSubmitting(false)
    }
  }

  const selectedParty = useMemo(() => parties.find((party) => party.id === partyId), [parties, partyId])

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <PageHeader
        eyebrow={isSale ? 'Point of sale' : 'Procurement'}
        title={isSale ? 'Penjualan' : 'Pembelian & Restock'}
        description={isSale
          ? 'Buat transaksi tunai atau kredit dengan pengalaman kasir yang cepat.'
          : 'Catat pembelian, perbarui stok, dan hitung harga modal rata-rata otomatis.'}
        actions={<Badge tone={syncState === 'offline' ? 'warning' : 'success'}>{syncState === 'offline' ? 'Transaksi akan diantrekan' : 'Siap memproses'}</Badge>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_420px]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3.5 text-slate-400" size={17} />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama produk atau SKU..." className="pl-10" />
              </div>
              <div className="relative min-w-44">
                <Select value={category} onChange={(event) => setCategory(event.target.value)} className="appearance-none pr-9">
                  {categories.map((item) => <option key={item}>{item}</option>)}
                </Select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 text-slate-400" size={16} />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((product) => {
              const item = cart.find((entry) => entry.productId === product.id)
              const low = product.stock <= product.minimumStock
              return (
                <button
                  key={product.id}
                  onClick={() => updateQuantity(product, 1)}
                  className="group min-h-44 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSale && product.stock <= 0}
                >
                  <div className="flex items-start justify-between">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-700">
                      <ShoppingBag size={20} />
                    </div>
                    {item && <span className="grid h-7 min-w-7 place-items-center rounded-full bg-brand-700 px-2 text-xs font-extrabold text-white">{item.quantity}</span>}
                  </div>
                  <p className="mt-4 line-clamp-2 text-sm font-extrabold text-slate-900">{product.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{product.sku} · {product.category}</p>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <p className="text-sm font-extrabold text-brand-700">{formatCurrency(isSale ? product.sellingPrice : product.purchasePrice)}</p>
                    <p className={`text-[11px] font-bold ${low ? 'text-amber-600' : 'text-slate-400'}`}>Stok {product.stock}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <Card className="h-fit overflow-hidden xl:sticky xl:top-24">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">{isSale ? 'Keranjang penjualan' : 'Daftar restock'}</h2>
                <p className="mt-1 text-xs text-slate-500">{cart.length} jenis produk</p>
              </div>
              {cart.length > 0 && <button className="text-xs font-bold text-red-500 hover:text-red-700" onClick={clear}>Kosongkan</button>}
            </div>
          </div>

          <div className="scrollbar-thin max-h-[40vh] min-h-48 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center p-6 text-center">
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-400"><PackageSearch size={24} /></div>
                <p className="mt-3 text-sm font-bold text-slate-700">Belum ada produk</p>
                <p className="mt-1 text-xs text-slate-400">Pilih produk dari katalog untuk memulai.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cart.map((item) => (
                  <div key={item.productId} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">{item.name}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{item.sku}</p>
                      </div>
                      <button className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500" onClick={() => setCart((current) => current.filter((entry) => entry.productId !== item.productId))}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center rounded-xl border border-slate-200">
                        <button className="p-2 text-slate-500 hover:text-brand-700" onClick={() => updateQuantity(item.product, -1)}><Minus size={15} /></button>
                        <span className="min-w-8 text-center text-sm font-extrabold">{item.quantity}</span>
                        <button className="p-2 text-slate-500 hover:text-brand-700" onClick={() => updateQuantity(item.product, 1)}><Plus size={15} /></button>
                      </div>
                      <div className="text-right">
                        {isSale && user?.role === 'owner' ? (
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(event) => setPrice(item.productId, Number(event.target.value))}
                            className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs font-bold"
                          />
                        ) : <p className="text-xs text-slate-400">@ {formatCurrency(item.unitPrice)}</p>}
                        <p className="mt-1 text-sm font-extrabold text-slate-900">{formatCurrency(item.subtotal)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 border-t border-slate-100 bg-slate-50/70 p-5">
            <div className="grid grid-cols-2 rounded-xl bg-white p-1 ring-1 ring-slate-200">
              <button onClick={() => setPaymentMode('cash')} className={`rounded-lg py-2 text-xs font-extrabold ${paymentMode === 'cash' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
                Tunai
              </button>
              <button onClick={() => setPaymentMode('credit')} className={`rounded-lg py-2 text-xs font-extrabold ${paymentMode === 'credit' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
                Kredit
              </button>
            </div>

            {paymentMode === 'credit' && (
              <div className="grid gap-3">
                <div className="relative">
                  <UserRound className="absolute left-3 top-3.5 text-slate-400" size={16} />
                  <Select value={partyId} onChange={(event) => setPartyId(event.target.value)} className="pl-9">
                    <option value="">Pilih {isSale ? 'pelanggan' : 'vendor'}</option>
                    {parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}
                  </Select>
                </div>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-3.5 text-slate-400" size={16} />
                  <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} min={today()} className="pl-9" />
                </div>
              </div>
            )}
            <Input value={invoice} onChange={(event) => setInvoice(event.target.value)} placeholder="Nomor referensi / catatan (opsional)" />

            <div className="flex items-center justify-between border-t border-dashed border-slate-300 pt-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Total transaksi</p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">{formatCurrency(total)}</p>
              </div>
              <div className="rounded-xl bg-brand-50 p-2.5 text-brand-700"><CreditCard size={22} /></div>
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={!cart.length || submitting || (paymentMode === 'credit' && (!partyId || !dueDate))}
              onClick={() => void submit()}
            >
              {submitting ? 'Memproses...' : isSale ? 'Posting penjualan' : 'Posting pembelian'}
            </Button>
          </div>
        </Card>
      </div>

      <Modal
        open={Boolean(receipt)}
        title={isSale ? 'Penjualan berhasil' : 'Pembelian berhasil'}
        description={syncState === 'offline' ? 'Transaksi tersimpan di perangkat dan akan disinkronkan.' : 'Transaksi dan jurnal sudah diposting.'}
        onClose={() => setReceipt(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReceipt(null)}>Selesai</Button>
            <Button onClick={() => window.print()}><Printer size={17} /> Cetak struk</Button>
          </>
        }
      >
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="mx-auto text-emerald-600" size={42} />
          <p className="mt-3 text-sm font-bold text-emerald-900">{receipt?.number}</p>
          <p className="mt-1 text-3xl font-extrabold text-emerald-950">{formatCurrency(receipt?.total ?? 0)}</p>
          {selectedParty && <p className="mt-2 text-xs text-emerald-700">{selectedParty.name}</p>}
        </div>
      </Modal>

      {receipt && (
        <div className="receipt-only">
          <h1 style={{ textAlign: 'center', fontWeight: 800 }}>{user?.tenantName}</h1>
          <p style={{ textAlign: 'center' }}>CompAcc Receipt</p>
          <hr />
          <p>{receipt.number}</p>
          <p>{receipt.date} · {receipt.paymentMode === 'cash' ? 'Tunai' : 'Kredit'}</p>
          <hr />
          {receipt.items.map((item) => (
            <div key={item.productId} style={{ marginBottom: 6 }}>
              <div>{item.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.quantity} × {formatCurrency(item.unitPrice)}</span>
                <strong>{formatCurrency(item.subtotal)}</strong>
              </div>
            </div>
          ))}
          <hr />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <strong>TOTAL</strong><strong>{formatCurrency(receipt.total)}</strong>
          </div>
          <p style={{ marginTop: 18, textAlign: 'center' }}>Terima kasih</p>
        </div>
      )}
    </div>
  )
}
