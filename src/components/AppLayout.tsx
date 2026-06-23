import {
  BadgeDollarSign,
  Banknote,
  BarChart3,
  BookOpenCheck,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  Cloud,
  CloudOff,
  FileBarChart,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  PackagePlus,
  ReceiptText,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  WalletCards,
  X
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '../lib/format'
import { useAppStore } from '../store/AppStore'
import type { Role } from '../types'
import { Badge, Button, Field, Input, Modal } from './ui'

const navGroups = [
  {
    label: 'Workspace',
    items: [
      { to: '/', label: 'Ringkasan', icon: LayoutDashboard, ownerOnly: true },
      { to: '/penjualan', label: 'Penjualan', icon: ShoppingCart },
      { to: '/pembelian', label: 'Pembelian', icon: PackagePlus, ownerOnly: true },
      { to: '/kas-beban', label: 'Kas & Beban', icon: Banknote, ownerOnly: true }
    ]
  },
  {
    label: 'Operasional',
    items: [
      { to: '/produk', label: 'Produk & Stok', icon: Boxes },
      { to: '/piutang', label: 'Piutang', icon: WalletCards },
      { to: '/utang', label: 'Utang', icon: BadgeDollarSign, ownerOnly: true }
    ]
  },
  {
    label: 'Keuangan',
    ownerOnly: true,
    items: [
      { to: '/akuntansi', label: 'Akuntansi', icon: BookOpenCheck },
      { to: '/laporan', label: 'Laporan', icon: FileBarChart },
      { to: '/pengaturan', label: 'Pengaturan', icon: Settings }
    ]
  }
]

function Sidebar({
  role,
  mobile,
  onNavigate
}: {
  role: Role
  mobile?: boolean
  onNavigate?: () => void
}) {
  return (
    <aside className={cn('flex h-full w-[278px] flex-col bg-slate-950 text-white', mobile ? '' : 'hidden lg:flex')}>
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 font-extrabold shadow-lg shadow-brand-950/30">C</div>
        <div>
          <p className="display-font text-lg font-extrabold tracking-tight">CompAcc</p>
          <p className="text-[11px] font-medium text-slate-400">Modern Cloud Accounting</p>
        </div>
      </div>
      <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-4 py-6">
        {navGroups.filter((group) => !group.ownerOnly || role === 'owner').map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-500">{group.label}</p>
            <div className="space-y-1">
              {group.items.filter((item) => !('ownerOnly' in item) || !item.ownerOnly || role === 'owner').map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                      isActive ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    )
                  }
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="rounded-2xl bg-white/5 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
            <Cloud size={15} />
            Sistem siap
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">Transaksi disimpan aman dan dapat diantrekan saat offline.</p>
        </div>
      </div>
    </aside>
  )
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut, changePassword, syncState, pendingJobs, syncNow, demoMode } = useAppStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null)
  if (!user) return null

  const openPasswordModal = () => {
    setProfileOpen(false)
    setPasswordOpen(true)
    setPasswordMessage(null)
  }

  const closePasswordModal = () => {
    if (passwordLoading) return
    setPasswordOpen(false)
    setPasswordForm({ password: '', confirm: '' })
    setPasswordMessage(null)
  }

  const submitPassword = async () => {
    setPasswordMessage(null)
    if (demoMode) {
      setPasswordMessage({ tone: 'info', text: 'Mode demo tidak menyimpan password. Fitur ini aktif di aplikasi cloud.' })
      return
    }
    if (passwordForm.password.length < 8) {
      setPasswordMessage({ tone: 'danger', text: 'Password minimal 8 karakter.' })
      return
    }
    if (passwordForm.password !== passwordForm.confirm) {
      setPasswordMessage({ tone: 'danger', text: 'Konfirmasi password belum sama.' })
      return
    }
    setPasswordLoading(true)
    try {
      await changePassword(passwordForm.password)
      setPasswordForm({ password: '', confirm: '' })
      setPasswordMessage({ tone: 'success', text: 'Password berhasil diperbarui. Gunakan password baru saat login berikutnya.' })
    } catch (error) {
      setPasswordMessage({ tone: 'danger', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setPasswordLoading(false)
    }
  }

  const syncLabels = {
    online: ['Online', 'success'] as const,
    offline: ['Offline', 'warning'] as const,
    syncing: ['Menyinkronkan', 'info'] as const,
    success: ['Tersinkron', 'success'] as const,
    conflict: ['Ada konflik', 'danger'] as const
  }
  const [syncLabel] = syncLabels[syncState]

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} />
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative">
            <Sidebar role={user.role} mobile onNavigate={() => setMobileOpen(false)} />
            <button className="absolute right-3 top-5 rounded-xl bg-white/10 p-2 text-white" onClick={() => setMobileOpen(false)}>
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-xl border border-slate-200 p-2 text-slate-600 lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu size={21} />
            </button>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-slate-400">Usaha aktif</p>
              <p className="display-font font-bold text-slate-900">{user.tenantName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {demoMode && <Badge tone="info">Mode demo</Badge>}
            <button
              onClick={() => void syncNow()}
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
              title={`${pendingJobs.length} antrean`}
            >
              {syncState === 'offline' ? <CloudOff size={16} /> : <RefreshCw size={16} className={syncState === 'syncing' ? 'animate-spin' : ''} />}
              <span className="hidden md:inline">{syncLabel}</span>
              {pendingJobs.length > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">{pendingJobs.length}</span>}
            </button>
            <div className="relative">
              <button className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-100" onClick={() => setProfileOpen((open) => !open)}>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-100 text-sm font-extrabold text-brand-800">
                  {user.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                </span>
                <div className="hidden text-left md:block">
                  <p className="text-xs font-bold text-slate-800">{user.fullName}</p>
                  <p className="text-[11px] capitalize text-slate-400">{user.role === 'owner' ? 'Owner' : 'Kasir'}</p>
                </div>
                <ChevronDown size={14} className="hidden text-slate-400 md:block" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <div className="border-b border-slate-100 px-3 py-3">
                    <p className="text-sm font-bold text-slate-900">{user.fullName}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <button onClick={openPasswordModal} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <LockKeyhole size={17} /> Ganti password
                  </button>
                  <button onClick={() => void signOut()} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                    <LogOut size={17} /> Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</main>

        <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-2xl backdrop-blur lg:hidden">
          {(user.role === 'owner' ? [
            { to: '/', label: 'Beranda', icon: BarChart3 },
            { to: '/penjualan', label: 'Jual', icon: ShoppingCart },
            { to: '/pembelian', label: 'Beli', icon: PackagePlus },
            { to: '/produk', label: 'Stok', icon: CircleDollarSign },
            { to: '/piutang', label: 'Tagihan', icon: ReceiptText }
          ] : [
            { to: '/penjualan', label: 'Kasir', icon: ShoppingCart },
            { to: '/produk', label: 'Stok', icon: CircleDollarSign },
            { to: '/piutang', label: 'Piutang', icon: ReceiptText }
          ]).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn('flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold', isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-400')}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Modal
        open={passwordOpen}
        title="Ganti password"
        description={`Perbarui password login untuk akun ${user.email}.`}
        onClose={closePasswordModal}
        footer={(
          <>
            <Button variant="secondary" onClick={closePasswordModal} disabled={passwordLoading}>Batal</Button>
            <Button onClick={() => void submitPassword()} disabled={passwordLoading}>
              <ShieldCheck size={16} /> {passwordLoading ? 'Menyimpan...' : 'Simpan password'}
            </Button>
          </>
        )}
      >
        <div className="space-y-5">
          <Field label="Password baru" hint="Minimal 8 karakter.">
            <Input
              type="password"
              autoComplete="new-password"
              value={passwordForm.password}
              onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })}
            />
          </Field>
          <Field label="Ulangi password baru">
            <Input
              type="password"
              autoComplete="new-password"
              value={passwordForm.confirm}
              onChange={(event) => setPasswordForm({ ...passwordForm, confirm: event.target.value })}
            />
          </Field>
          {passwordMessage && (
            <div className={`rounded-xl p-3 text-sm font-semibold ${
              passwordMessage.tone === 'success'
                ? 'bg-emerald-50 text-emerald-700'
                : passwordMessage.tone === 'info'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'bg-red-50 text-red-700'
            }`}>
              {passwordMessage.text}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
