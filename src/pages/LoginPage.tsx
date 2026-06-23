import { ArrowRight, BarChart3, Boxes, CheckCircle2, Cloud, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { Button, Field, Input } from '../components/ui'
import { useAppStore } from '../store/AppStore'

export default function LoginPage() {
  const { signIn, demoMode } = useAppStore()
  const [email, setEmail] = useState(demoMode ? 'owner@compacc.demo' : '')
  const [password, setPassword] = useState(demoMode ? 'demo-compacc' : '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signIn(email, password)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.28),transparent_28rem),radial-gradient(circle_at_85%_80%,rgba(16,185,129,0.13),transparent_24rem)]" />
        <div className="relative">
          <div className="flex items-center gap-3 text-white">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 font-extrabold">C</div>
            <div><p className="display-font text-xl font-extrabold">CompAcc</p><p className="text-xs text-slate-400">Modern Cloud Accounting</p></div>
          </div>
        </div>
        <div className="relative max-w-2xl">
          <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-brand-300">Satu workspace. Seluruh usaha.</p>
          <h1 className="mt-5 text-5xl font-extrabold leading-[1.12] tracking-tight text-white">Operasional retail bertemu akuntansi yang rapi.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">Jalankan kasir, stok, piutang, utang, dan laporan keuangan tanpa berpindah aplikasi.</p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              [ReceiptText, 'POS & kredit'],
              [Boxes, 'Stok real-time'],
              [BarChart3, 'Laporan akurat']
            ].map(([Icon, label]) => {
              const Component = Icon as typeof ReceiptText
              return <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-300 backdrop-blur"><Component size={22} className="text-brand-300" /><p className="mt-3 text-sm font-bold">{String(label)}</p></div>
            })}
          </div>
        </div>
        <p className="relative text-xs text-slate-600">CompAcc · Dibangun untuk operasional yang bergerak cepat.</p>
      </section>

      <section className="flex items-center justify-center bg-slate-50 p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-700 font-extrabold text-white">C</div>
            <p className="display-font text-xl font-extrabold">CompAcc</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-soft sm:p-9">
            <div className="mb-7">
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Cloud size={23} /></div>
              <h2 className="text-2xl font-extrabold text-slate-950">Masuk ke workspace</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Gunakan akun yang sudah didaftarkan oleh Owner usaha.</p>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <Field label="Email"><Input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
              <Field label="Password"><Input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
              {error && <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
              <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? 'Memverifikasi...' : <>Masuk <ArrowRight size={17} /></>}</Button>
            </form>
            {demoMode && (
              <div className="mt-5 rounded-xl bg-emerald-50 p-3">
                <p className="flex items-center gap-2 text-xs font-bold text-emerald-700"><CheckCircle2 size={15} /> Mode demo aktif</p>
                <p className="mt-1 text-xs leading-5 text-emerald-600">Klik Masuk untuk mencoba seluruh modul tanpa Supabase.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
