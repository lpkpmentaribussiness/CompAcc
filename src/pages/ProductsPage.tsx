import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, Download, Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable } from '../components/DataTable'
import { Badge, Button, Card, Field, Input, Modal, PageHeader } from '../components/ui'
import { downloadCsv, formatCurrency, formatNumber } from '../lib/format'
import { useAppStore } from '../store/AppStore'
import type { Product } from '../types'

const emptyForm = {
  id: '', sku: '', name: '', category: '', purchasePrice: 0, sellingPrice: 0, stock: 0, minimumStock: 0
}

export default function ProductsPage() {
  const { snapshot, saveProduct, user } = useAppStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const edit = (product?: Product) => {
    setForm(product ? {
      id: product.id, sku: product.sku, name: product.name, category: product.category,
      purchasePrice: product.purchasePrice, sellingPrice: product.sellingPrice, stock: product.stock,
      minimumStock: product.minimumStock
    } : emptyForm)
    setOpen(true)
  }

  const columns = useMemo<ColumnDef<Product>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Produk',
      cell: ({ row }) => (
        <div>
          <p className="font-bold text-slate-800">{row.original.name}</p>
          <p className="mt-0.5 text-xs text-slate-400">{row.original.sku} · {row.original.category}</p>
        </div>
      )
    },
    {
      accessorKey: 'stock',
      header: 'Stok',
      cell: ({ row }) => {
        const low = row.original.stock <= row.original.minimumStock
        return <Badge tone={low ? 'warning' : 'success'}>{low && <AlertTriangle size={12} className="mr-1" />}{formatNumber(row.original.stock)}</Badge>
      }
    },
    ...(user?.role === 'owner' ? [{
      accessorKey: 'purchasePrice',
      header: 'Harga modal',
      cell: ({ row }: { row: { original: Product } }) => <span className="text-slate-600">{formatCurrency(row.original.purchasePrice)}</span>
    }] as ColumnDef<Product>[] : []),
    {
      accessorKey: 'sellingPrice',
      header: 'Harga jual',
      cell: ({ row }) => <span className="font-bold text-slate-900">{formatCurrency(row.original.sellingPrice)}</span>
    },
    {
      id: 'margin',
      header: 'Margin',
      cell: ({ row }) => {
        const margin = row.original.sellingPrice > 0 ? ((row.original.sellingPrice - row.original.purchasePrice) / row.original.sellingPrice) * 100 : 0
        return <span className="font-semibold text-emerald-600">{margin.toFixed(1)}%</span>
      }
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => user?.role === 'owner' ? (
        <Button variant="ghost" size="sm" onClick={() => edit(row.original)}><Pencil size={15} /> Edit</Button>
      ) : null
    }
  ], [user?.role])

  const submit = async () => {
    if (!form.sku.trim() || !form.name.trim()) return
    setSaving(true)
    try {
      await saveProduct({
        ...form,
        id: form.id || undefined,
        sku: form.sku.trim().toUpperCase(),
        name: form.name.trim(),
        active: true
      })
      setOpen(false)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <PageHeader
        eyebrow="Inventory"
        title="Produk & stok"
        description="Kelola katalog, harga, batas stok minimum, dan nilai persediaan."
        actions={
          <>
            <Button variant="secondary" onClick={() => downloadCsv('produk-compacc.csv', snapshot.products.map((item) => ({
              SKU: item.sku, Produk: item.name, Kategori: item.category, Stok: item.stock,
              'Harga Modal': item.purchasePrice, 'Harga Jual': item.sellingPrice
            })))}><Download size={17} /> Ekspor</Button>
            {user?.role === 'owner' && <Button onClick={() => edit()}><Plus size={17} /> Produk baru</Button>}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Total SKU aktif</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-950">{snapshot.products.filter((item) => item.active).length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Stok menipis</p>
          <p className="mt-2 text-3xl font-extrabold text-amber-600">{snapshot.products.filter((item) => item.stock <= item.minimumStock).length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Nilai persediaan</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-950">{formatCurrency(snapshot.products.reduce((sum, item) => sum + item.stock * item.purchasePrice, 0))}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <DataTable data={snapshot.products} columns={columns} searchPlaceholder="Cari produk, SKU, atau kategori..." />
      </Card>

      <Modal
        open={open}
        title={form.id ? 'Edit produk' : 'Produk baru'}
        description="Harga modal digunakan untuk menghitung HPP dan nilai persediaan."
        onClose={() => setOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan produk'}</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU"><Input value={form.sku} readOnly={Boolean(form.id)} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="PRD-001" /></Field>
          <Field label="Kategori"><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Minuman" /></Field>
          <Field label="Nama produk" className="sm:col-span-2"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nama yang tampil di POS" /></Field>
          <Field label="Harga modal"><Input type="number" min="0" value={form.purchasePrice} onChange={(event) => setForm({ ...form, purchasePrice: Number(event.target.value) })} /></Field>
          <Field label="Harga jual"><Input type="number" min="0" value={form.sellingPrice} onChange={(event) => setForm({ ...form, sellingPrice: Number(event.target.value) })} /></Field>
          <Field label="Stok awal"><Input type="number" min="0" value={form.stock} onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })} /></Field>
          <Field label="Batas stok minimum"><Input type="number" min="0" value={form.minimumStock} onChange={(event) => setForm({ ...form, minimumStock: Number(event.target.value) })} /></Field>
        </div>
      </Modal>
    </div>
  )
}
