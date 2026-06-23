import type { Account, AppSnapshot, JournalEntry, Party, Product, Transaction, UserProfile } from '../types'

const tenantId = 'tenant-demo'

export const demoUser: UserProfile = {
  id: 'user-demo-owner',
  email: 'owner@compacc.demo',
  fullName: 'Sofian Mentari',
  role: 'owner',
  tenantId,
  tenantName: 'Kedai Senandika',
  tenantActive: true,
  isPlatformCreator: true
}

export const demoAccounts: Account[] = [
  { id: 'acc-cash', tenantId, code: '1000', name: 'Kas & Bank', category: 'asset', normalBalance: 'debit', systemKey: 'cash', active: true },
  { id: 'acc-ar', tenantId, code: '1100', name: 'Piutang Usaha', category: 'asset', normalBalance: 'debit', systemKey: 'receivables', active: true },
  { id: 'acc-inventory', tenantId, code: '1150', name: 'Persediaan Barang', category: 'asset', normalBalance: 'debit', systemKey: 'inventory', active: true },
  { id: 'acc-ap', tenantId, code: '2000', name: 'Utang Usaha', category: 'liability', normalBalance: 'credit', systemKey: 'payables', active: true },
  { id: 'acc-capital', tenantId, code: '3000', name: 'Modal Pemilik', category: 'equity', normalBalance: 'credit', systemKey: 'capital', active: true },
  { id: 'acc-revenue', tenantId, code: '4000', name: 'Pendapatan Penjualan', category: 'revenue', normalBalance: 'credit', systemKey: 'sales_revenue', active: true },
  { id: 'acc-cogs', tenantId, code: '5050', name: 'Harga Pokok Penjualan', category: 'expense', normalBalance: 'debit', systemKey: 'cogs', active: true },
  { id: 'acc-rent', tenantId, code: '5100', name: 'Beban Sewa', category: 'expense', normalBalance: 'debit', active: true },
  { id: 'acc-utilities', tenantId, code: '5200', name: 'Beban Listrik & Internet', category: 'expense', normalBalance: 'debit', active: true }
]

export const demoProducts: Product[] = [
  { id: 'prd-1', tenantId, sku: 'KOP-001', name: 'Kopi Susu Aren', category: 'Minuman', purchasePrice: 9000, sellingPrice: 22000, stock: 38, minimumStock: 10, active: true, updatedAt: new Date().toISOString() },
  { id: 'prd-2', tenantId, sku: 'KOP-002', name: 'Americano', category: 'Minuman', purchasePrice: 6500, sellingPrice: 18000, stock: 24, minimumStock: 8, active: true, updatedAt: new Date().toISOString() },
  { id: 'prd-3', tenantId, sku: 'SNK-001', name: 'Croissant Butter', category: 'Makanan', purchasePrice: 11000, sellingPrice: 24000, stock: 7, minimumStock: 8, active: true, updatedAt: new Date().toISOString() },
  { id: 'prd-4', tenantId, sku: 'BOT-001', name: 'Cold Brew Bottle', category: 'Botolan', purchasePrice: 14000, sellingPrice: 32000, stock: 16, minimumStock: 6, active: true, updatedAt: new Date().toISOString() },
  { id: 'prd-5', tenantId, sku: 'SNK-002', name: 'Banana Bread', category: 'Makanan', purchasePrice: 8500, sellingPrice: 19000, stock: 4, minimumStock: 6, active: true, updatedAt: new Date().toISOString() },
  { id: 'prd-6', tenantId, sku: 'MER-001', name: 'Tumbler Senandika', category: 'Merchandise', purchasePrice: 48000, sellingPrice: 85000, stock: 11, minimumStock: 3, active: true, updatedAt: new Date().toISOString() }
]

export const demoParties: Party[] = [
  { id: 'party-1', tenantId, type: 'customer', name: 'PT Ruang Karya', phone: '0812-7000-2026', email: 'finance@ruangkarya.id' },
  { id: 'party-2', tenantId, type: 'customer', name: 'Studio Utara', phone: '0813-9000-1122' },
  { id: 'party-3', tenantId, type: 'vendor', name: 'Nusantara Coffee Supply', phone: '021-555-0192' },
  { id: 'party-4', tenantId, type: 'vendor', name: 'Dapur Pagi Bakery', phone: '0811-2255-7788' }
]

const isoDay = (offset: number) => {
  const value = new Date()
  value.setDate(value.getDate() + offset)
  return value.toISOString().slice(0, 10)
}

export const demoTransactions: Transaction[] = [
  {
    id: 'tx-sale-1', clientRequestId: 'demo-request-1', tenantId, kind: 'sale', paymentMode: 'cash',
    number: 'SAL-2026-0042', date: isoDay(-1), description: 'Penjualan retail', total: 176000,
    paidAmount: 176000, remainingAmount: 0, status: 'posted', invoiceStatus: 'paid',
    items: [
      { productId: 'prd-1', sku: 'KOP-001', name: 'Kopi Susu Aren', quantity: 5, unitPrice: 22000, unitCost: 9000, subtotal: 110000 },
      { productId: 'prd-2', sku: 'KOP-002', name: 'Americano', quantity: 2, unitPrice: 18000, unitCost: 6500, subtotal: 36000 },
      { productId: 'prd-5', sku: 'SNK-002', name: 'Banana Bread', quantity: 1, unitPrice: 19000, unitCost: 8500, subtotal: 19000 }
    ],
    createdBy: demoUser.id, createdAt: new Date().toISOString()
  },
  {
    id: 'tx-sale-2', clientRequestId: 'demo-request-2', tenantId, kind: 'sale', paymentMode: 'credit',
    number: 'INV-2026-0018', date: isoDay(-12), dueDate: isoDay(2), partyId: 'party-1', partyName: 'PT Ruang Karya',
    description: 'Coffee break kantor', total: 1250000, paidAmount: 500000, remainingAmount: 750000,
    status: 'posted', invoiceStatus: 'partial',
    items: [{ productId: 'prd-1', sku: 'KOP-001', name: 'Kopi Susu Aren', quantity: 50, unitPrice: 25000, unitCost: 9000, subtotal: 1250000 }],
    createdBy: demoUser.id, createdAt: new Date().toISOString()
  },
  {
    id: 'tx-purchase-1', clientRequestId: 'demo-request-3', tenantId, kind: 'purchase', paymentMode: 'credit',
    number: 'PUR-2026-0011', date: isoDay(-20), dueDate: isoDay(-3), partyId: 'party-3', partyName: 'Nusantara Coffee Supply',
    description: 'Restock bahan dan botolan', total: 1800000, paidAmount: 800000, remainingAmount: 1000000,
    status: 'posted', invoiceStatus: 'overdue',
    items: [{ productId: 'prd-4', sku: 'BOT-001', name: 'Cold Brew Bottle', quantity: 100, unitPrice: 18000, unitCost: 18000, subtotal: 1800000 }],
    createdBy: demoUser.id, createdAt: new Date().toISOString()
  },
  {
    id: 'tx-expense-1', clientRequestId: 'demo-request-4', tenantId, kind: 'expense', paymentMode: 'cash',
    number: 'EXP-2026-0016', date: isoDay(-4), description: 'Internet dan listrik bulan berjalan', total: 760000,
    paidAmount: 760000, remainingAmount: 0, status: 'posted', invoiceStatus: 'paid', items: [],
    createdBy: demoUser.id, createdAt: new Date().toISOString()
  }
]

export const demoJournals: JournalEntry[] = [
  {
    id: 'je-opening', tenantId, number: 'JE-2026-0001', date: isoDay(-30), description: 'Modal awal',
    source: 'manual', status: 'posted', createdAt: new Date().toISOString(),
    lines: [
      { accountId: 'acc-cash', accountCode: '1000', accountName: 'Kas & Bank', debit: 12000000, credit: 0 },
      { accountId: 'acc-capital', accountCode: '3000', accountName: 'Modal Pemilik', debit: 0, credit: 12000000 }
    ]
  },
  {
    id: 'je-sale-1', tenantId, transactionId: 'tx-sale-1', number: 'JE-2026-0042', date: isoDay(-1), description: 'Penjualan retail',
    source: 'sale', status: 'posted', createdAt: new Date().toISOString(),
    lines: [
      { accountId: 'acc-cash', accountCode: '1000', accountName: 'Kas & Bank', debit: 176000, credit: 0 },
      { accountId: 'acc-revenue', accountCode: '4000', accountName: 'Pendapatan Penjualan', debit: 0, credit: 176000 },
      { accountId: 'acc-cogs', accountCode: '5050', accountName: 'Harga Pokok Penjualan', debit: 66500, credit: 0 },
      { accountId: 'acc-inventory', accountCode: '1150', accountName: 'Persediaan Barang', debit: 0, credit: 66500 }
    ]
  },
  {
    id: 'je-sale-2', tenantId, transactionId: 'tx-sale-2', number: 'JE-2026-0018', date: isoDay(-12), description: 'Coffee break kantor',
    source: 'sale', status: 'posted', createdAt: new Date().toISOString(),
    lines: [
      { accountId: 'acc-ar', accountCode: '1100', accountName: 'Piutang Usaha', debit: 1250000, credit: 0 },
      { accountId: 'acc-revenue', accountCode: '4000', accountName: 'Pendapatan Penjualan', debit: 0, credit: 1250000 },
      { accountId: 'acc-cogs', accountCode: '5050', accountName: 'Harga Pokok Penjualan', debit: 450000, credit: 0 },
      { accountId: 'acc-inventory', accountCode: '1150', accountName: 'Persediaan Barang', debit: 0, credit: 450000 }
    ]
  },
  {
    id: 'je-purchase-1', tenantId, transactionId: 'tx-purchase-1', number: 'JE-2026-0011', date: isoDay(-20), description: 'Restock bahan dan botolan',
    source: 'purchase', status: 'posted', createdAt: new Date().toISOString(),
    lines: [
      { accountId: 'acc-inventory', accountCode: '1150', accountName: 'Persediaan Barang', debit: 1800000, credit: 0 },
      { accountId: 'acc-ap', accountCode: '2000', accountName: 'Utang Usaha', debit: 0, credit: 1800000 }
    ]
  },
  {
    id: 'je-expense-1', tenantId, transactionId: 'tx-expense-1', number: 'JE-2026-0016', date: isoDay(-4), description: 'Internet dan listrik bulan berjalan',
    source: 'expense', status: 'posted', createdAt: new Date().toISOString(),
    lines: [
      { accountId: 'acc-utilities', accountCode: '5200', accountName: 'Beban Listrik & Internet', debit: 760000, credit: 0 },
      { accountId: 'acc-cash', accountCode: '1000', accountName: 'Kas & Bank', debit: 0, credit: 760000 }
    ]
  }
]

export const demoSnapshot: AppSnapshot = {
  products: demoProducts,
  parties: demoParties,
  accounts: demoAccounts,
  transactions: demoTransactions,
  payments: [
    { id: 'pay-1', tenantId, transactionId: 'tx-sale-2', date: isoDay(-5), amount: 500000, accountId: 'acc-cash', note: 'Transfer tahap pertama' },
    { id: 'pay-2', tenantId, transactionId: 'tx-purchase-1', date: isoDay(-10), amount: 800000, accountId: 'acc-cash', note: 'Pembayaran awal' }
  ],
  journals: demoJournals,
  conflicts: []
}
