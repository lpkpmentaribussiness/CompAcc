# CompAcc Modern Cloud Accounting

CompAcc adalah aplikasi POS, persediaan, piutang/utang, dan akuntansi multi-tenant yang dibangun dengan React, TypeScript, Supabase, Vercel, dan PWA.

## Menjalankan lokal

```powershell
npm install
npm run dev
```

Tanpa `.env.local`, aplikasi otomatis berjalan dalam **mode demo** dengan data lokal. Isi `.env.local` berdasarkan `.env.example` untuk mengaktifkan Supabase.

## Menyiapkan Supabase

1. Buat project Supabase baru.
2. Hubungkan project lokal ke Supabase:

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
```

3. Jalankan migration:

```powershell
npx supabase db push
```

4. Deploy Edge Function undangan:

```powershell
npx supabase functions deploy invite-member
```

5. Salin project URL dan anon key ke `.env.local`.
6. Siapkan environment server-only untuk membuat usaha dan Owner pertama:

```powershell
$env:SUPABASE_URL="https://project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="service-role-key"
npm run bootstrap:tenant -- owner@example.com "password-kuat" "Nama Usaha" "Nama Owner"
```

Service role hanya boleh digunakan pada mesin admin atau secret CI. Jangan pernah memakai prefix `VITE_` untuk key tersebut.

## Deployment GitHub + Vercel

1. Push repository ini ke GitHub.
2. Di Vercel, pilih **Add New Project** lalu import repository GitHub tersebut.
3. Pastikan pengaturan build:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Output directory: `dist`
4. Tambahkan Environment Variables di Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy.
6. Setelah domain Vercel tersedia, tambahkan URL berikut di Supabase Auth:
   - Site URL: `https://domain-vercel-anda`
   - Redirect URLs:
     - `https://domain-vercel-anda/*`
     - `http://localhost:5173/*` untuk pengujian lokal

File `vercel.json` sudah menyiapkan rewrite SPA agar refresh halaman seperti `/reports` atau `/settings` tetap membuka aplikasi.

## Model keamanan

- Seluruh tabel bisnis membawa `tenant_id`.
- Row Level Security membatasi akses berdasarkan membership aktif.
- Owner mendapat modul akuntansi, laporan, pengaturan, harga modal, dan pembatalan.
- Kasir hanya mendapat modul operasional.
- Penjualan, pembelian, beban, pembayaran, jurnal manual, pembatalan, dan sinkronisasi offline berjalan melalui RPC atomik.
- Transaksi terposting tidak diedit atau dihapus; koreksi memakai jurnal balik.

## Offline

PWA menyimpan snapshot data dan antrean transaksi di IndexedDB. UUID `client_request_id` menjamin idempotensi. Konflik stok atau saldo disimpan di `sync_conflicts` dan harus diselesaikan Owner.

## Versi lama

Implementasi Google Apps Script asli dipertahankan di `legacy-google-apps-script/`.
