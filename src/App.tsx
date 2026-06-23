import { lazy, Suspense } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import LoginPage from './pages/LoginPage'
import { useAppStore } from './store/AppStore'

const AccountingPage = lazy(() => import('./pages/AccountingPage'))
const CashExpensesPage = lazy(() => import('./pages/CashExpensesPage'))
const CommercePage = lazy(() => import('./pages/CommercePage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'))
const ProductsPage = lazy(() => import('./pages/ProductsPage'))
const PlatformPage = lazy(() => import('./pages/PlatformPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function PageLoader() {
  return <div className="grid min-h-[60vh] place-items-center"><LoaderCircle className="animate-spin text-brand-600" size={28} /></div>
}

export default function App() {
  const { user, loading, signOut } = useAppStore()
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <div className="text-center"><LoaderCircle className="mx-auto animate-spin text-brand-400" size={32} /><p className="mt-4 text-sm font-semibold text-slate-400">Menyiapkan workspace...</p></div>
      </div>
    )
  }
  if (!user) return <LoginPage />
  if (!user.tenantActive) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white">
        <div className="max-w-md text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-500/15 text-2xl">!</div>
          <h1 className="mt-5 text-2xl font-extrabold">Akses perusahaan dinonaktifkan</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">Hubungi pengelola CompAcc untuk mengaktifkan kembali workspace {user.tenantName}.</p>
          <button className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950" onClick={() => void signOut()}>Keluar</button>
        </div>
      </div>
    )
  }
  const owner = user.role === 'owner'
  return (
    <AppLayout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={owner ? <DashboardPage /> : <Navigate to="/penjualan" replace />} />
          <Route path="/penjualan" element={<CommercePage kind="sale" />} />
          <Route path="/pembelian" element={owner ? <CommercePage kind="purchase" /> : <Navigate to="/penjualan" replace />} />
          <Route path="/kas-beban" element={owner ? <CashExpensesPage /> : <Navigate to="/penjualan" replace />} />
          <Route path="/produk" element={<ProductsPage />} />
          <Route path="/piutang" element={<InvoicesPage type="receivable" />} />
          <Route path="/utang" element={owner ? <InvoicesPage type="payable" /> : <Navigate to="/" replace />} />
          <Route path="/akuntansi" element={owner ? <AccountingPage /> : <Navigate to="/" replace />} />
          <Route path="/laporan" element={owner ? <ReportsPage /> : <Navigate to="/" replace />} />
          <Route path="/pengaturan" element={owner ? <SettingsPage /> : <Navigate to="/" replace />} />
          <Route path="/platform" element={user.isPlatformCreator ? <PlatformPage /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  )
}
