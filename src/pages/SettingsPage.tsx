import type { ColumnDef } from '@tanstack/react-table'
import { AlertOctagon, Building2, Plus, RefreshCw, Trash2, UserRoundPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DataTable } from '../components/DataTable'
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select } from '../components/ui'
import { cloudEnabled, supabase } from '../lib/supabase'
import { useAppStore } from '../store/AppStore'
import type { Party } from '../types'

interface Member {
  id: string
  fullName: string
  email: string
  role: 'owner' | 'cashier'
  active: boolean
}

export default function SettingsPage() {
  const { user, snapshot, saveParty, pendingJobs, retryConflict, discardConflict } = useAppStore()
  const [partyOpen, setPartyOpen] = useState(false)
  const [party, setParty] = useState({ name: '', type: 'customer' as Party['type'], phone: '', email: '', address: '' })
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invite, setInvite] = useState({ fullName: '', email: '', role: 'cashier' as Member['role'] })
  const [inviting, setInviting] = useState(false)
  const [members, setMembers] = useState<Member[]>([
    { id: 'demo-owner', fullName: user?.fullName ?? 'Owner', email: user?.email ?? '', role: 'owner', active: true },
    { id: 'demo-cashier', fullName: 'Totok Sediyantoro', email: 'kasir@compacc.demo', role: 'cashier', active: true }
  ])

  useEffect(() => {
    if (!supabase || !user) return
    supabase
      .from('memberships')
      .select('id,full_name,email,role,active')
      .eq('tenant_id', user.tenantId)
      .order('created_at')
      .then(({ data }) => {
        if (!data) return
        setMembers(data.map((item) => ({
          id: item.id,
          fullName: item.full_name,
          email: item.email,
          role: item.role,
          active: item.active
        })))
      })
  }, [user])

  const partyColumns = useMemo<ColumnDef<Party>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Nama',
      cell: ({ row }) => <div><p className="font-bold text-slate-800">{row.original.name}</p><p className="mt-0.5 text-xs text-slate-400">{row.original.email || row.original.phone || 'Tanpa kontak'}</p></div>
    },
    { accessorKey: 'type', header: 'Tipe', cell: ({ row }) => <Badge tone="info">{row.original.type === 'customer' ? 'Pelanggan' : row.original.type === 'vendor' ? 'Vendor' : 'Pelanggan & Vendor'}</Badge> },
    { accessorKey: 'phone', header: 'Telepon', cell: ({ row }) => row.original.phone || '—' },
    { accessorKey: 'address', header: 'Alamat', cell: ({ row }) => row.original.address || '—' }
  ], [])

  const submitParty = async () => {
    if (!party.name.trim()) return
    await saveParty({ ...party, name: party.name.trim() })
    setPartyOpen(false)
    setParty({ name: '', type: 'customer', phone: '', email: '', address: '' })
  }

  const submitInvite = async () => {
    if (!invite.fullName.trim() || !invite.email.trim()) return
    setInviting(true)
    try {
      if (supabase) {
        const { data, error } = await supabase.functions.invoke('invite-member', {
          body: {
            tenantId: user?.tenantId,
            email: invite.email.trim().toLowerCase(),
            fullName: invite.fullName.trim(),
            role: invite.role
          }
        })
        if (error) throw error
        setMembers((current) => [...current, {
          id: data.membershipId,
          fullName: invite.fullName.trim(),
          email: invite.email.trim().toLowerCase(),
          role: invite.role,
          active: true
        }])
      } else {
        setMembers((current) => [...current, {
          id: crypto.randomUUID(),
          fullName: invite.fullName.trim(),
          email: invite.email.trim().toLowerCase(),
          role: invite.role,
          active: true
        }])
      }
      setInviteOpen(false)
      setInvite({ fullName: '', email: '', role: 'cashier' })
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <PageHeader
        eyebrow="Administration"
        title="Pengaturan"
        description="Kelola identitas usaha, pengguna, pihak transaksi, dan konflik sinkronisasi."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-50 p-3 text-brand-700"><Building2 size={22} /></div>
            <div><h2 className="font-extrabold text-slate-900">Profil usaha</h2><p className="mt-1 text-xs text-slate-500">Identitas pada struk dan laporan.</p></div>
          </div>
          <div className="mt-6 space-y-4">
            <Field label="Nama usaha"><Input defaultValue={user?.tenantName} /></Field>
            <Field label="Email usaha"><Input type="email" defaultValue="finance@senandika.id" /></Field>
            <Field label="Alamat"><Input defaultValue="Jakarta, Indonesia" /></Field>
            <Button>Simpan profil</Button>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Users size={20} /></div>
              <div><h2 className="font-extrabold text-slate-900">Pengguna usaha</h2><p className="mt-1 text-xs text-slate-500">Owner dan Kasir aktif.</p></div>
            </div>
            <Button size="sm" onClick={() => setInviteOpen(true)}><UserRoundPlus size={16} /> Undang pengguna</Button>
          </div>
          <div className="divide-y divide-slate-100">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-4 p-5">
                <div className={`grid h-10 w-10 place-items-center rounded-xl font-extrabold ${member.role === 'owner' ? 'bg-brand-100 text-brand-800' : 'bg-amber-100 text-amber-800'}`}>
                  {member.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0 flex-1"><p className="font-bold text-slate-800">{member.fullName}</p><p className="truncate text-xs text-slate-400">{member.email}</p></div>
                <Badge tone={member.role === 'owner' ? 'info' : 'warning'}>{member.role === 'owner' ? 'Owner' : 'Kasir'}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="font-extrabold text-slate-900">Pelanggan & vendor</h2>
            <p className="mt-1 text-xs text-slate-500">Digunakan pada transaksi kredit dan laporan umur tagihan.</p>
          </div>
          <Button size="sm" onClick={() => setPartyOpen(true)}><Plus size={16} /> Tambah pihak</Button>
        </div>
        <DataTable data={snapshot.parties} columns={partyColumns} searchPlaceholder="Cari pelanggan atau vendor..." />
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-red-50 p-2.5 text-red-600"><AlertOctagon size={20} /></div>
            <div><h2 className="font-extrabold text-slate-900">Pusat konflik sinkronisasi</h2><p className="mt-1 text-xs text-slate-500">Transaksi bermasalah tidak masuk jurnal sebelum diselesaikan.</p></div>
          </div>
          <Badge tone={snapshot.conflicts.length ? 'danger' : 'success'}>{snapshot.conflicts.length} konflik</Badge>
        </div>
        {snapshot.conflicts.length === 0 && pendingJobs.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">Tidak ada konflik. Semua data sudah aman.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {snapshot.conflicts.map((conflict) => (
              <div key={conflict.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800">{conflict.type}</p>
                  <p className="mt-1 text-sm text-red-600">{conflict.message}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void retryConflict(conflict.id)}><RefreshCw size={15} /> Coba lagi</Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => void discardConflict(conflict.id)}><Trash2 size={15} /> Buang</Button>
                </div>
              </div>
            ))}
            {pendingJobs.filter((job) => job.state !== 'conflict').map((job) => (
              <div key={job.id} className="flex items-center gap-3 p-5">
                <RefreshCw size={17} className="text-amber-500" />
                <div className="flex-1"><p className="text-sm font-bold text-slate-700">{job.type}</p><p className="text-xs text-slate-400">Menunggu koneksi untuk sinkronisasi</p></div>
                <Badge tone="warning">Antrean</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={partyOpen}
        title="Tambah pelanggan atau vendor"
        description="Data pihak dipakai bersama pada penjualan dan pembelian kredit."
        onClose={() => setPartyOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setPartyOpen(false)}>Batal</Button><Button onClick={() => void submitParty()}>Simpan</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama" className="sm:col-span-2"><Input value={party.name} onChange={(event) => setParty({ ...party, name: event.target.value })} /></Field>
          <Field label="Tipe">
            <Select value={party.type} onChange={(event) => setParty({ ...party, type: event.target.value as Party['type'] })}>
              <option value="customer">Pelanggan</option>
              <option value="vendor">Vendor</option>
              <option value="both">Keduanya</option>
            </Select>
          </Field>
          <Field label="Telepon"><Input value={party.phone} onChange={(event) => setParty({ ...party, phone: event.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={party.email} onChange={(event) => setParty({ ...party, email: event.target.value })} /></Field>
          <Field label="Alamat"><Input value={party.address} onChange={(event) => setParty({ ...party, address: event.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={inviteOpen}
        title="Undang pengguna"
        description={cloudEnabled ? 'Supabase akan mengirim email undangan untuk membuat password.' : 'Mode demo tidak mengirim email sungguhan.'}
        onClose={() => setInviteOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setInviteOpen(false)}>Batal</Button><Button onClick={() => void submitInvite()} disabled={inviting}>{inviting ? 'Mengirim...' : 'Kirim undangan'}</Button></>}
      >
        <div className="space-y-4">
          <Field label="Nama lengkap"><Input value={invite.fullName} onChange={(event) => setInvite({ ...invite, fullName: event.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} /></Field>
          <Field label="Role">
            <Select value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value as Member['role'] })}>
              <option value="cashier">Kasir</option>
              <option value="owner">Owner</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
