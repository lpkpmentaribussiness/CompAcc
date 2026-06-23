import { Building2, Crown, Mail, Plus, Power, RefreshCw, UserRoundCog } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Card, Field, Input, Modal, PageHeader } from '../components/ui'
import { formatDate } from '../lib/format'
import { cloudApi, supabase } from '../lib/supabase'
import type { PlatformCompany } from '../types'

const emptyCompany = {
  companyName: '',
  companyEmail: '',
  ownerName: '',
  ownerEmail: ''
}

export default function PlatformPage() {
  const [companies, setCompanies] = useState<PlatformCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [companyOpen, setCompanyOpen] = useState(false)
  const [companyForm, setCompanyForm] = useState(emptyCompany)
  const [replaceCompany, setReplaceCompany] = useState<PlatformCompany | null>(null)
  const [ownerForm, setOwnerForm] = useState({ ownerName: '', ownerEmail: '' })
  const [saving, setSaving] = useState(false)

  const loadCompanies = useCallback(async () => {
    if (!supabase) {
      setCompanies([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase.rpc('list_platform_companies')
    setLoading(false)
    if (error) {
      window.alert(error.message)
      return
    }
    setCompanies((data ?? []).map((item: Record<string, unknown>) => ({
      id: String(item.id),
      name: String(item.name),
      email: item.email ? String(item.email) : undefined,
      active: Boolean(item.active),
      createdAt: String(item.created_at),
      ownerName: String(item.owner_name ?? ''),
      ownerEmail: String(item.owner_email ?? ''),
      ownerActive: Boolean(item.owner_active),
      cashierCount: Number(item.cashier_count ?? 0)
    })))
  }, [])

  useEffect(() => {
    void loadCompanies()
  }, [loadCompanies])

  const invokeCreator = async (body: Record<string, unknown>) => {
    if (!supabase) throw new Error('Panel Creator hanya tersedia pada aplikasi cloud.')
    const { data, error } = await supabase.functions.invoke('creator-company', { body })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return data
  }

  const createCompany = async () => {
    if (!companyForm.companyName.trim() || !companyForm.ownerName.trim() || !companyForm.ownerEmail.trim()) return
    setSaving(true)
    try {
      await invokeCreator({
        action: 'provision',
        companyName: companyForm.companyName.trim(),
        companyEmail: companyForm.companyEmail.trim().toLowerCase(),
        ownerName: companyForm.ownerName.trim(),
        ownerEmail: companyForm.ownerEmail.trim().toLowerCase()
      })
      setCompanyOpen(false)
      setCompanyForm(emptyCompany)
      await loadCompanies()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  const replaceOwner = async () => {
    if (!replaceCompany || !ownerForm.ownerName.trim() || !ownerForm.ownerEmail.trim()) return
    setSaving(true)
    try {
      await invokeCreator({
        action: 'replace_owner',
        tenantId: replaceCompany.id,
        ownerName: ownerForm.ownerName.trim(),
        ownerEmail: ownerForm.ownerEmail.trim().toLowerCase()
      })
      setReplaceCompany(null)
      setOwnerForm({ ownerName: '', ownerEmail: '' })
      await loadCompanies()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  const sendAccess = async (company: PlatformCompany) => {
    setSaving(true)
    try {
      await invokeCreator({ action: 'send_access', tenantId: company.id })
      window.alert(`Email akses dikirim ke ${company.ownerEmail}.`)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  const toggleCompany = async (company: PlatformCompany) => {
    const action = company.active ? 'menonaktifkan' : 'mengaktifkan'
    if (!window.confirm(`Yakin ingin ${action} ${company.name}?`)) return
    setSaving(true)
    try {
      await cloudApi.setCompanyActive(company.id, !company.active)
      await loadCompanies()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <PageHeader
        eyebrow="Platform creator"
        title="Perusahaan CompAcc"
        description="Buat workspace dan akun Owner. Data keuangan setiap perusahaan tetap terisolasi."
        actions={<Button onClick={() => setCompanyOpen(true)}><Plus size={17} /> Perusahaan baru</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Total perusahaan</p>
          <p className="mt-2 text-3xl font-extrabold">{companies.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Workspace aktif</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-600">{companies.filter((company) => company.active).length}</p>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-brand-50 p-3 text-brand-700"><Crown size={22} /></div>
          <div><p className="font-extrabold text-slate-900">Creator tunggal</p><p className="mt-1 text-xs text-slate-500">Tidak memiliki akses data keuangan pelanggan.</p></div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="font-extrabold text-slate-900">Daftar perusahaan</h2>
            <p className="mt-1 text-xs text-slate-500">Metadata workspace, Owner, dan jumlah Kasir aktif.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void loadCompanies()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Muat ulang
          </Button>
        </div>
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Memuat perusahaan...</div>
        ) : companies.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">Belum ada perusahaan.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {companies.map((company) => (
              <div key={company.id} className="grid gap-4 p-5 xl:grid-cols-[1.2fr_1fr_auto] xl:items-center">
                <div className="flex items-center gap-4">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-600"><Building2 size={20} /></div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-extrabold text-slate-900">{company.name}</p>
                      <Badge tone={company.active ? 'success' : 'danger'}>{company.active ? 'Aktif' : 'Nonaktif'}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Dibuat {formatDate(company.createdAt.slice(0, 10))} · {company.cashierCount} Kasir aktif</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{company.ownerName || 'Owner belum tersedia'}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{company.ownerEmail || '—'}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" size="sm" disabled={saving} onClick={() => void sendAccess(company)}><Mail size={15} /> Kirim akses</Button>
                  <Button variant="ghost" size="sm" disabled={saving} onClick={() => {
                    setReplaceCompany(company)
                    setOwnerForm({ ownerName: '', ownerEmail: '' })
                  }}><UserRoundCog size={15} /> Ganti Owner</Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    className={company.active ? 'text-red-600' : 'text-emerald-600'}
                    onClick={() => void toggleCompany(company)}
                  >
                    <Power size={15} /> {company.active ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={companyOpen}
        title="Buat workspace perusahaan"
        description="Sistem membuat tenant, akun buku besar bawaan, dan mengirim undangan kepada satu Owner."
        onClose={() => !saving && setCompanyOpen(false)}
        footer={<><Button variant="secondary" disabled={saving} onClick={() => setCompanyOpen(false)}>Batal</Button><Button disabled={saving || !companyForm.companyName.trim() || !companyForm.ownerName.trim() || !companyForm.ownerEmail.trim()} onClick={() => void createCompany()}>{saving ? 'Membuat...' : 'Buat dan kirim undangan'}</Button></>}
      >
        <div className="space-y-4">
          <Field label="Nama perusahaan"><Input value={companyForm.companyName} onChange={(event) => setCompanyForm({ ...companyForm, companyName: event.target.value })} /></Field>
          <Field label="Email perusahaan" hint="Opsional, untuk identitas workspace."><Input type="email" value={companyForm.companyEmail} onChange={(event) => setCompanyForm({ ...companyForm, companyEmail: event.target.value })} /></Field>
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-4 text-sm font-extrabold text-slate-900">Owner pertama</p>
            <div className="space-y-4">
              <Field label="Nama lengkap"><Input value={companyForm.ownerName} onChange={(event) => setCompanyForm({ ...companyForm, ownerName: event.target.value })} /></Field>
              <Field label="Email Owner"><Input type="email" value={companyForm.ownerEmail} onChange={(event) => setCompanyForm({ ...companyForm, ownerEmail: event.target.value })} /></Field>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(replaceCompany)}
        title="Ganti Owner perusahaan"
        description={`Owner lama ${replaceCompany?.name ?? ''} akan dinonaktifkan setelah undangan Owner baru berhasil dibuat.`}
        onClose={() => !saving && setReplaceCompany(null)}
        footer={<><Button variant="secondary" disabled={saving} onClick={() => setReplaceCompany(null)}>Batal</Button><Button disabled={saving || !ownerForm.ownerName.trim() || !ownerForm.ownerEmail.trim()} onClick={() => void replaceOwner()}>{saving ? 'Mengganti...' : 'Ganti dan kirim undangan'}</Button></>}
      >
        <div className="space-y-4">
          <Field label="Nama Owner baru"><Input value={ownerForm.ownerName} onChange={(event) => setOwnerForm({ ...ownerForm, ownerName: event.target.value })} /></Field>
          <Field label="Email Owner baru"><Input type="email" value={ownerForm.ownerEmail} onChange={(event) => setOwnerForm({ ...ownerForm, ownerEmail: event.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  )
}
