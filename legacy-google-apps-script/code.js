/**
 * CompAcc - Backend Google Apps Script
 * Satu database usaha dapat dipakai bersama oleh Owner dan Kasir.
 */

const CONFIG = Object.freeze({
  APP_NAME: 'CompAcc',
  DB_PREFIX: 'CompAcc DB - ',
  TIME_ZONE: 'Asia/Jakarta',
  SESSION_TTL_SECONDS: 21600,
  SCHEMA_VERSION: '8',
  SHEETS: {
    AKUN: 'Akun',
    JURNAL: 'Jurnal',
    PROFIL: 'Profil',
    BARANG: 'Barang',
    PENGGUNA: 'Pengguna'
  }
});

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('CompAcc - Aplikasi Akuntansi Retail')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function loginDenganToken(tokenLogin) {
  const ss = bukaSpreadsheetUtama_();
  const tokenHash = hashTokenLogin_(teksWajib_(tokenLogin, 'Token login'));
  let pengguna = bacaPenggunaInternal_(ss).find(item =>
    item.status === 'Aktif' && item.tokenHash === tokenHash
  );

  if (!pengguna) {
    pengguna = aktifkanBootstrapOwner_(ss, tokenHash);
  }
  if (!pengguna) throw new Error('Token login salah, tidak aktif, atau sudah diganti.');

  const sessionToken = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(
    keySesi_(sessionToken),
    JSON.stringify({
      email: pengguna.email,
      nama: pengguna.nama,
      tokenHash: tokenHash,
      dibuatPada: Date.now()
    }),
    CONFIG.SESSION_TTL_SECONDS
  );
  return {
    sessionToken: sessionToken,
    email: pengguna.email,
    nama: pengguna.nama,
    role: pengguna.role
  };
}

function logoutAplikasi(sessionToken) {
  if (sessionToken) CacheService.getScriptCache().remove(keySesi_(sessionToken));
  return { sukses: true };
}

function dapatkanDataAwal(sessionToken) {
  const auth = autentikasi_(sessionToken);
  const ss = auth.ss;
  const role = auth.role;
  const email = auth.email;
  const profil = bacaProfil_(ss);
  profil.role = role;
  const barang = bacaBarang_(ss);
  return {
    email: email,
    role: role,
    database: role === 'Owner' ? {
      id: ss.getId(),
      nama: ss.getName()
    } : null,
    profil: profil,
    akun: role === 'Owner' ? bacaAkun_(ss) : [],
    akunTransaksi: batasiAkunTransaksi_(bacaAkun_(ss)),
    jurnal: role === 'Owner' ? bacaJurnal_(ss) : [],
    barang: batasiBarangSesuaiRole_(barang, role),
    pengguna: role === 'Owner' ? bacaPengguna_(ss) : []
  };
}

function bukaSpreadsheetUtama_() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const primaryKey = 'SOF_PRIMARY_DB_ID';
  const idBersama = scriptProperties.getProperty(primaryKey);

  if (idBersama) {
    const ssTersimpan = SpreadsheetApp.openById(idBersama);
    const emailOwner = normalisasiEmail_(Session.getEffectiveUser().getEmail());
    pastikanSkema_(ssTersimpan, emailOwner);
    return ssTersimpan;
  }

  const email = normalisasiEmail_(Session.getEffectiveUser().getEmail());
  if (!email) throw new Error('Email Owner tidak tersedia untuk inisialisasi database.');
  const userProperties = PropertiesService.getUserProperties();
  const idLama = userProperties.getProperty('SOF_DB_ID');
  if (idLama) {
    try {
      const ssLama = SpreadsheetApp.openById(idLama);
      pastikanSkema_(ssLama, email);
      pastikanOwnerMigrasi_(ssLama, email);
      scriptProperties.setProperty(primaryKey, ssLama.getId());
      return ssLama;
    } catch (error) {
      userProperties.deleteProperty('SOF_DB_ID');
    }
  }

  const namaDatabase = CONFIG.DB_PREFIX + email;
  const hasil = DriveApp.getFilesByName(namaDatabase);
  let ss;

  if (hasil.hasNext()) {
    ss = SpreadsheetApp.openById(hasil.next().getId());
  } else {
    ss = SpreadsheetApp.create(namaDatabase);
  }

  pastikanSkema_(ss, email);
  pastikanOwnerMigrasi_(ss, email);
  userProperties.setProperty('SOF_DB_ID', ss.getId());
  scriptProperties.setProperty(primaryKey, ss.getId());
  return ss;
}

function tentukanTipeUser_(email) {
  return /@gmail\.com$/i.test(email) ? 'Personal' : 'Company';
}

function pastikanSkema_(ss, email) {
  const properti = PropertiesService.getScriptProperties();
  const key = 'SOF_SCHEMA_' + ss.getId();
  if (properti.getProperty(key) === CONFIG.SCHEMA_VERSION) return;
  inisialisasiSkemaUser(ss, tentukanTipeUser_(email), email);
  properti.setProperty(key, CONFIG.SCHEMA_VERSION);
}

function inisialisasiSkemaUser(ss, tipeUser, email) {
  const akun = pastikanSheet_(ss, CONFIG.SHEETS.AKUN, [
    'Kode Akun', 'Nama Akun', 'Kategori', 'Saldo Awal'
  ]);
  if (akun.getLastRow() === 1) {
    const defaultAkun = tipeUser === 'Personal'
      ? [
          ['1000', 'Kas & Rekening Tabungan', 'Harta Lancar', 0],
          ['1150', 'Persediaan Barang Dagang', 'Harta Lancar', 0],
          ['3000', 'Modal Pribadi', 'Ekuitas', 0],
          ['4000', 'Pendapatan Penjualan Retail', 'Pendapatan', 0],
          ['5000', 'Beban Konsumsi & Operasional', 'Beban', 0],
          ['5050', 'Harga Pokok Penjualan (HPP)', 'Beban', 0]
        ]
      : [
          ['1000', 'Kas & Setara Kas', 'Harta Lancar', 0],
          ['1100', 'Piutang Usaha', 'Harta Lancar', 0],
          ['1150', 'Persediaan Barang Dagang', 'Harta Lancar', 0],
          ['1200', 'Aset Tetap Peralatan', 'Harta Tetap', 0],
          ['2000', 'Utang Usaha', 'Utang Lancar', 0],
          ['3000', 'Modal Pemilik', 'Ekuitas', 0],
          ['4000', 'Pendapatan Penjualan Retail', 'Pendapatan', 0],
          ['5000', 'Beban Gaji Karyawan', 'Beban', 0],
          ['5050', 'Harga Pokok Penjualan (HPP)', 'Beban', 0],
          ['5100', 'Beban Sewa & Operasional', 'Beban', 0]
        ];
    akun.getRange(2, 1, defaultAkun.length, 4).setValues(defaultAkun);
  }
  pastikanAkunInti_(akun);

  const jurnal = pastikanSheet_(ss, CONFIG.SHEETS.JURNAL, [
    'ID Transaksi', 'Tanggal', 'No Referensi', 'Keterangan',
    'Kode Akun', 'Debet', 'Kredit', 'Nama Pihak', 'Jatuh Tempo', 'Jenis Transaksi',
    'SKU', 'Qty', 'ID Transaksi Asal'
  ]);
  jurnal.getRange(1, 1, 1, 13).setValues([[
    'ID Transaksi', 'Tanggal', 'No Referensi', 'Keterangan',
    'Kode Akun', 'Debet', 'Kredit', 'Nama Pihak', 'Jatuh Tempo', 'Jenis Transaksi',
    'SKU', 'Qty', 'ID Transaksi Asal'
  ]]);
  if (jurnal.getLastRow() === 1) {
    const saldoAwal = tipeUser === 'Personal' ? 1000000 : 10000000;
    const tanggal = tanggalHariIni_();
    jurnal.getRange(2, 1, 2, 13).setValues([
      ['TX-INIT-1', tanggal, 'REF-000', 'Saldo Awal Kas', '1000', saldoAwal, 0, '', '', 'Saldo Awal', '', '', ''],
      ['TX-INIT-1', tanggal, 'REF-000', 'Saldo Awal Modal', '3000', 0, saldoAwal, '', '', 'Saldo Awal', '', '', '']
    ]);
  }

  const profil = pastikanSheet_(ss, CONFIG.SHEETS.PROFIL, [
    'Nama Perusahaan', 'Alamat', 'Telepon', 'Email', 'No HP', 'Role Akses Default'
  ]);
  if (profil.getLastRow() === 1) {
    profil.getRange(2, 1, 1, 6).setValues([
      ['CompAcc Tenant', '', '', email, '', 'Owner']
    ]);
  }

  const barang = pastikanSheet_(ss, CONFIG.SHEETS.BARANG, [
    'Kode SKU', 'Nama Barang', 'Kategori Barang',
    'Harga Beli', 'Harga Jual', 'Stok Saat Ini'
  ]);
  if (barang.getLastRow() === 1 && tipeUser === 'Company') {
    barang.getRange(2, 1, 2, 6).setValues([
      ['SKU-001', 'Kopi Susu Literan', 'Minuman', 20000, 45000, 50],
      ['SKU-002', 'Keripik Kentang Original', 'Cemilan', 8000, 15000, 100]
    ]);
  }

  const pengguna = pastikanSheet_(ss, CONFIG.SHEETS.PENGGUNA, [
    'Email / ID Login', 'Nama', 'Role', 'Status', 'Dibuat Pada',
    'Token Hash', 'Token Dibuat Pada'
  ]);
  if (pengguna.getLastRow() === 1) {
    pengguna.getRange(2, 1, 1, 7).setValues([[
      normalisasiEmail_(email), 'Pemilik', 'Owner', 'Aktif', new Date(), '', ''
    ]]);
  }

  formatSheet_(akun, [1, 2, 3, 4]);
  formatSheet_(jurnal, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  formatSheet_(profil, [1, 2, 3, 4, 5, 6]);
  formatSheet_(barang, [1, 2, 3, 4, 5, 6]);
  formatSheet_(pengguna, [1, 2, 3, 4, 5, 6, 7]);

  const sheetBawaan = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
  if (sheetBawaan && ss.getSheets().length > 1) {
    ss.deleteSheet(sheetBawaan);
  }
}

function pastikanSheet_(ss, nama, header) {
  let sheet = ss.getSheetByName(nama);
  if (!sheet) sheet = ss.insertSheet(nama);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, header.length).setValues([header]);
  return sheet;
}

function formatSheet_(sheet, kolom) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, kolom.length)
    .setFontWeight('bold')
    .setBackground('#1e3a8a')
    .setFontColor('#ffffff');
  sheet.autoResizeColumns(1, kolom.length);
}

function pastikanAkunInti_(sheet) {
  const kodeAda = new Set(bacaData_(sheet, 4).map(row => String(row[0])));
  const akunInti = [
    ['1000', 'Kas & Setara Kas', 'Harta Lancar', 0],
    ['1100', 'Piutang Usaha', 'Harta Lancar', 0],
    ['1150', 'Persediaan Barang Dagang', 'Harta Lancar', 0],
    ['2000', 'Utang Usaha', 'Utang Lancar', 0],
    ['3000', 'Modal Pemilik', 'Ekuitas', 0],
    ['4000', 'Pendapatan Penjualan Retail', 'Pendapatan', 0],
    ['5050', 'Harga Pokok Penjualan (HPP)', 'Beban', 0]
  ].filter(row => !kodeAda.has(row[0]));
  if (akunInti.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, akunInti.length, 4).setValues(akunInti);
  }
}

// --- AKUN ---

function dapatkanAkun(sessionToken) {
  const auth = autentikasi_(sessionToken, 'Owner');
  const ss = auth.ss;
  return bacaAkun_(ss);
}

function bacaAkun_(ss) {
  const data = bacaData_(ss.getSheetByName(CONFIG.SHEETS.AKUN), 4);
  return data.map(row => ({
    kode: String(row[0]),
    nama: String(row[1] || ''),
    kategori: String(row[2] || ''),
    saldoAwal: angka_(row[3])
  }));
}

function simpanAkun(sessionToken, akun) {
  return denganLock_(function () {
    const auth = autentikasi_(sessionToken, 'Owner');
    const ss = auth.ss;
    const nilai = {
      kode: teksWajib_(akun && akun.kode, 'Kode akun'),
      nama: teksWajib_(akun && akun.nama, 'Nama akun'),
      kategori: teksWajib_(akun && akun.kategori, 'Kategori akun'),
      saldoAwal: 0
    };
    if (!/^[A-Za-z0-9._-]{1,20}$/.test(nilai.kode)) {
      throw new Error('Kode akun hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda minus.');
    }

    const sheet = ss.getSheetByName(CONFIG.SHEETS.AKUN);
    const data = bacaData_(sheet, 4);
    const index = data.findIndex(row => String(row[0]) === nilai.kode);
    const row = [nilai.kode, nilai.nama, nilai.kategori, nilai.saldoAwal];

    if (index >= 0) sheet.getRange(index + 2, 1, 1, 4).setValues([row]);
    else sheet.appendRow(row);
    return { sukses: true };
  });
}

function hapusAkun(sessionToken, kode) {
  return denganLock_(function () {
    kode = teksWajib_(kode, 'Kode akun');
    const auth = autentikasi_(sessionToken, 'Owner');
    const ss = auth.ss;
    const dipakai = bacaData_(ss.getSheetByName(CONFIG.SHEETS.JURNAL), 10)
      .some(row => String(row[4]) === kode);
    if (dipakai) throw new Error('Akun tidak dapat dihapus karena sudah digunakan dalam jurnal.');

    const sheet = ss.getSheetByName(CONFIG.SHEETS.AKUN);
    const data = bacaData_(sheet, 4);
    const index = data.findIndex(row => String(row[0]) === kode);
    if (index < 0) return { sukses: false };
    sheet.deleteRow(index + 2);
    return { sukses: true };
  });
}

// --- JURNAL ---

function dapatkanJurnal(sessionToken) {
  const auth = autentikasi_(sessionToken, 'Owner');
  const ss = auth.ss;
  return bacaJurnal_(ss);
}

function bacaJurnal_(ss) {
  const jurnal = bacaData_(ss.getSheetByName(CONFIG.SHEETS.JURNAL), 13)
    .map(row => ({
      id: String(row[0]),
      tanggal: formatTanggal_(row[1]),
      noRef: String(row[2] || ''),
      keterangan: String(row[3] || ''),
      kodeAkun: String(row[4]),
      debet: angka_(row[5]),
      kredit: angka_(row[6]),
      namaPihak: String(row[7] || ''),
      jatuhTempo: formatTanggal_(row[8]),
      jenisTransaksi: String(row[9] || ''),
      sku: String(row[10] || ''),
      qty: angka_(row[11]),
      idAsal: String(row[12] || '')
    }));
  const kelompok = [];
  jurnal.forEach(function (baris) {
    const terakhir = kelompok[kelompok.length - 1];
    if (terakhir && terakhir[0].id === baris.id) terakhir.push(baris);
    else kelompok.push([baris]);
  });
  return kelompok.reverse().reduce(function (hasil, transaksi) {
    return hasil.concat(transaksi);
  }, []);
}

function simpanJurnalMulti(sessionToken, baris) {
  return denganLock_(function () {
    if (!Array.isArray(baris) || baris.length < 2) {
      throw new Error('Jurnal minimal terdiri dari dua baris.');
    }

    const auth = autentikasi_(sessionToken, 'Owner');
    const ss = auth.ss;
    const kodeValid = new Set(bacaAkun_(ss).map(akun => akun.kode));
    const id = 'TX-' + Date.now();
    const hasil = baris.map(function (item) {
      const kode = teksWajib_(item.kodeAkun, 'Kode akun');
      if (!kodeValid.has(kode)) throw new Error('Kode akun ' + kode + ' tidak ditemukan.');
      const debet = angkaNonNegatif_(item.debet, 'Debet');
      const kredit = angkaNonNegatif_(item.kredit, 'Kredit');
      if ((debet > 0 && kredit > 0) || (debet === 0 && kredit === 0)) {
        throw new Error('Setiap baris jurnal harus berisi salah satu nilai debet atau kredit.');
      }
      return [
        id,
        tanggalValid_(item.tanggal),
        teksOpsional_(item.noRef, 50),
        teksWajib_(item.keterangan, 'Keterangan'),
        kode,
        debet,
        kredit,
        '',
        '',
        'Jurnal Manual'
      ];
    });

    const totalDebet = hasil.reduce((sum, row) => sum + row[5], 0);
    const totalKredit = hasil.reduce((sum, row) => sum + row[6], 0);
    if (Math.abs(totalDebet - totalKredit) > 0.001) {
      throw new Error('Jurnal tidak seimbang. Total debet harus sama dengan total kredit.');
    }

    const sheet = ss.getSheetByName(CONFIG.SHEETS.JURNAL);
    sheet.getRange(sheet.getLastRow() + 1, 1, hasil.length, 10).setValues(hasil);
    return { sukses: true, id: id };
  });
}

function hapusTransaksi(sessionToken, id) {
  return denganLock_(function () {
    id = teksWajib_(id, 'ID transaksi');
    if (/^(TX-INIT-|POS-|RESTOCK-|BELI-KREDIT-|EXP-|VOID-)/i.test(id)) {
      throw new Error('Transaksi otomatis tidak boleh dihapus langsung dari jurnal.');
    }
    const auth = autentikasi_(sessionToken, 'Owner');
    const ss = auth.ss;
    const sheet = ss.getSheetByName(CONFIG.SHEETS.JURNAL);
    const data = bacaData_(sheet, 10);
    let terhapus = 0;
    for (let index = data.length - 1; index >= 0; index--) {
      if (String(data[index][0]) === id) {
        sheet.deleteRow(index + 2);
        terhapus++;
      }
    }
    return { sukses: terhapus > 0 };
  });
}

function batalkanTransaksi(sessionToken, id) {
  return denganLock_(function () {
    id = teksWajib_(id, 'ID transaksi');
    const auth = autentikasi_(sessionToken, 'Owner');
    const ss = auth.ss;

    if (/^(TX-INIT-|VOID-)/i.test(id)) {
      throw new Error('Saldo awal atau transaksi pembatalan tidak dapat dibatalkan.');
    }

    const sheetJurnal = ss.getSheetByName(CONFIG.SHEETS.JURNAL);
    const seluruhJurnal = bacaData_(sheetJurnal, 13);
    const transaksi = seluruhJurnal.filter(row => String(row[0]) === id);
    if (!transaksi.length) throw new Error('Transaksi tidak ditemukan.');
    if (seluruhJurnal.some(row => String(row[12] || '') === id)) {
      throw new Error('Transaksi ini sudah pernah dibatalkan.');
    }

    const infoStok = dapatkanInfoStokTransaksi_(ss, transaksi);
    const saldoAkun = {};
    bacaAkun_(ss).forEach(akun => saldoAkun[akun.kode] = akun);

    transaksi.forEach(function (row) {
      const akun = saldoAkun[String(row[4])];
      const nilaiKreditPembatalan = angka_(row[5]);
      if (akunKasBankDiizinkan_(akun) && nilaiKreditPembatalan > 0) {
        const saldo = hitungSaldoAkunServer_(ss, akun.kode);
        if (saldo + 0.001 < nilaiKreditPembatalan) {
          throw new Error(
            'Pembatalan membutuhkan pengeluaran dari ' + akun.nama +
            ', tetapi saldonya hanya ' + formatAngkaRupiah_(saldo) + '.'
          );
        }
      }
    });

    const sheetBarang = ss.getSheetByName(CONFIG.SHEETS.BARANG);
    let dataBarangLama = null;
    let barisBarang = 0;
    let dataBarangBaru = null;

    if (infoStok) {
      const dataBarang = bacaData_(sheetBarang, 6);
      const indexBarang = dataBarang.findIndex(row => String(row[0]) === infoStok.sku);
      if (indexBarang < 0) throw new Error('Barang transaksi tidak ditemukan dalam Master Barang.');

      dataBarangLama = dataBarang[indexBarang].slice();
      barisBarang = indexBarang + 2;
      const stokSekarang = angka_(dataBarangLama[5]);
      const hargaBeliSekarang = angka_(dataBarangLama[3]);

      if (infoStok.penjualan) {
        dataBarangBaru = [
          dataBarangLama[0], dataBarangLama[1], dataBarangLama[2],
          hargaBeliSekarang, dataBarangLama[4], stokSekarang + infoStok.qty
        ];
      } else {
        if (stokSekarang + 0.001 < infoStok.qty) {
          throw new Error(
            'Pembelian tidak dapat dibatalkan karena stok tersisa lebih kecil dari qty transaksi.'
          );
        }
        const stokBaru = stokSekarang - infoStok.qty;
        const nilaiPersediaanBaru = (stokSekarang * hargaBeliSekarang) - infoStok.totalPembelian;
        if (nilaiPersediaanBaru < -0.01) {
          throw new Error('Nilai persediaan tidak cukup untuk membatalkan pembelian ini.');
        }
        const hargaBeliBaru = stokBaru > 0 ? Math.max(0, nilaiPersediaanBaru / stokBaru) : 0;
        dataBarangBaru = [
          dataBarangLama[0], dataBarangLama[1], dataBarangLama[2],
          hargaBeliBaru, dataBarangLama[4], stokBaru
        ];
      }
    }

    const idPembatalan = 'VOID-' + Date.now();
    const tanggal = tanggalHariIni_();
    const jurnalBalik = transaksi.map(function (row) {
      return [
        idPembatalan,
        tanggal,
        'BATAL-' + id,
        'Pembatalan ' + id + ': ' + String(row[3] || ''),
        String(row[4]),
        angka_(row[6]),
        angka_(row[5]),
        String(row[7] || ''),
        '',
        'Pembatalan Transaksi',
        infoStok ? infoStok.sku : '',
        infoStok ? infoStok.qty : '',
        id
      ];
    });

    try {
      if (dataBarangBaru) {
        sheetBarang.getRange(barisBarang, 1, 1, 6).setValues([dataBarangBaru]);
      }
      sheetJurnal
        .getRange(sheetJurnal.getLastRow() + 1, 1, jurnalBalik.length, 13)
        .setValues(jurnalBalik);
    } catch (error) {
      if (dataBarangLama) {
        sheetBarang.getRange(barisBarang, 1, 1, 6).setValues([dataBarangLama]);
      }
      throw error;
    }

    return {
      sukses: true,
      idPembatalan: idPembatalan,
      transaksiAsal: id,
      stokDisesuaikan: Boolean(infoStok)
    };
  });
}

// --- BARANG ---

function dapatkanBarang(sessionToken) {
  const auth = autentikasi_(sessionToken);
  return batasiBarangSesuaiRole_(bacaBarang_(auth.ss), auth.role);
}

function bacaBarang_(ss) {
  return bacaData_(ss.getSheetByName(CONFIG.SHEETS.BARANG), 6).map(row => ({
    sku: String(row[0]),
    nama: String(row[1] || ''),
    kategori: String(row[2] || ''),
    hargaBeli: angka_(row[3]),
    hargaJual: angka_(row[4]),
    stok: angka_(row[5])
  }));
}

function batasiBarangSesuaiRole_(barang, role) {
  if (role !== 'Kasir') return barang;
  return barang.map(item => ({
    sku: item.sku,
    nama: item.nama,
    kategori: item.kategori,
    hargaBeli: item.hargaBeli,
    hargaJual: item.hargaJual
  }));
}

function simpanBarang(sessionToken, barang) {
  return denganLock_(function () {
    const nilai = validasiBarang_(barang);
    const auth = autentikasi_(sessionToken, 'Owner');
    const ss = auth.ss;
    const sheet = ss.getSheetByName(CONFIG.SHEETS.BARANG);
    const data = bacaData_(sheet, 6);
    const index = data.findIndex(row =>
      String(row[0]).toLowerCase() === nilai.sku.toLowerCase()
    );
    const row = [
      nilai.sku, nilai.nama, nilai.kategori,
      nilai.hargaBeli, nilai.hargaJual, nilai.stok
    ];
    if (index >= 0) sheet.getRange(index + 2, 1, 1, 6).setValues([row]);
    else sheet.appendRow(row);
    return { sukses: true };
  });
}

function hapusBarang(sessionToken, sku) {
  return denganLock_(function () {
    sku = teksWajib_(sku, 'SKU');
    const auth = autentikasi_(sessionToken, 'Owner');
    const ss = auth.ss;
    const sheet = ss.getSheetByName(CONFIG.SHEETS.BARANG);
    const data = bacaData_(sheet, 6);
    const index = data.findIndex(row =>
      String(row[0]).toLowerCase() === sku.toLowerCase()
    );
    if (index < 0) return { sukses: false };
    sheet.deleteRow(index + 2);
    return { sukses: true };
  });
}

// --- PROFIL ---

function dapatkanProfil(sessionToken) {
  const auth = autentikasi_(sessionToken, 'Owner');
  const ss = auth.ss;
  return bacaProfil_(ss);
}

function bacaProfil_(ss) {
  const data = bacaData_(ss.getSheetByName(CONFIG.SHEETS.PROFIL), 6);
  if (!data.length) return {};
  const row = data[0];
  return {
    nama: String(row[0] || ''),
    alamat: String(row[1] || ''),
    telepon: String(row[2] || ''),
    email: String(row[3] || ''),
    nohp: String(row[4] || '')
  };
}

function simpanProfil(sessionToken, profil) {
  return denganLock_(function () {
    const auth = autentikasi_(sessionToken, 'Owner');
    const ss = auth.ss;
    const row = [[
      teksWajib_(profil && profil.nama, 'Nama usaha'),
      teksOpsional_(profil && profil.alamat, 250),
      teksOpsional_(profil && profil.telepon, 30),
      teksOpsional_(profil && profil.email, 100),
      teksOpsional_(profil && profil.nohp, 30),
      'Per Pengguna'
    ]];
    ss
      .getSheetByName(CONFIG.SHEETS.PROFIL)
      .getRange(2, 1, 1, 6)
      .setValues(row);
    return { sukses: true };
  });
}

// --- PENGGUNA & HAK AKSES ---

function dapatkanPengguna(sessionToken) {
  const auth = autentikasi_(sessionToken, 'Owner');
  const ss = auth.ss;
  return bacaPengguna_(ss);
}

function bacaPengguna_(ss) {
  return bacaPenggunaInternal_(ss).map(item => ({
    email: item.email,
    nama: item.nama,
    role: item.role,
    status: item.status,
    dibuatPada: item.dibuatPada,
    tokenDibuatPada: item.tokenDibuatPada,
    punyaToken: item.punyaToken
  }));
}

function bacaPenggunaInternal_(ss) {
  return bacaData_(ss.getSheetByName(CONFIG.SHEETS.PENGGUNA), 7).map(row => ({
    email: normalisasiEmail_(row[0]),
    nama: String(row[1] || ''),
    role: row[2] === 'Owner' ? 'Owner' : 'Kasir',
    status: row[3] === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
    dibuatPada: formatTanggal_(row[4]),
    tokenHash: String(row[5] || ''),
    tokenDibuatPada: formatTanggal_(row[6]),
    punyaToken: Boolean(row[5])
  }));
}

function simpanPengguna(sessionToken, pengguna) {
  return denganLock_(function () {
    const auth = autentikasi_(sessionToken, 'Owner');
    const ss = auth.ss;

    const email = normalisasiEmail_(pengguna && pengguna.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Email pengguna tidak valid.');
    }
    const nama = teksWajib_(pengguna && pengguna.nama, 'Nama pengguna');
    const role = pengguna && pengguna.role === 'Owner' ? 'Owner' : 'Kasir';
    const status = pengguna && pengguna.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif';
    const emailAktif = auth.email;
    const sheet = ss.getSheetByName(CONFIG.SHEETS.PENGGUNA);
    const data = bacaData_(sheet, 7);
    const index = data.findIndex(row => normalisasiEmail_(row[0]) === email);

    if (email === emailAktif && (role !== 'Owner' || status !== 'Aktif')) {
      throw new Error('Owner yang sedang login tidak dapat menonaktifkan atau menurunkan role dirinya sendiri.');
    }

    if (index >= 0 && data[index][2] === 'Owner' && (role !== 'Owner' || status !== 'Aktif')) {
      const ownerAktif = data.filter((row, i) =>
        i !== index && row[2] === 'Owner' && row[3] !== 'Nonaktif'
      ).length;
      if (ownerAktif === 0) throw new Error('Usaha harus memiliki minimal satu Owner aktif.');
    }

    const dibuatPada = index >= 0 && data[index][4] ? data[index][4] : new Date();
    const tokenHash = index >= 0 ? String(data[index][5] || '') : '';
    const tokenDibuatPada = index >= 0 ? data[index][6] || '' : '';
    const row = [email, nama, role, status, dibuatPada, tokenHash, tokenDibuatPada];
    if (index >= 0) sheet.getRange(index + 2, 1, 1, 7).setValues([row]);
    else sheet.appendRow(row);

    cabutAksesSpreadsheet_(ss, email);
    if (index < 0 || !tokenHash) {
      return buatUlangTokenPengguna_(ss, email);
    }
    return { sukses: true, tokenBaru: '' };
  });
}

function nonaktifkanPengguna(sessionToken, email) {
  const pengguna = { email: email, nama: '', role: 'Kasir', status: 'Nonaktif' };
  const auth = autentikasi_(sessionToken, 'Owner');
  const ss = auth.ss;
  const data = bacaPengguna_(ss);
  const lama = data.find(item => item.email === normalisasiEmail_(email));
  if (!lama) return { sukses: false };
  pengguna.nama = lama.nama;
  pengguna.role = lama.role;
  return simpanPengguna(sessionToken, pengguna);
}

function buatUlangTokenPengguna(sessionToken, email) {
  return denganLock_(function () {
    const auth = autentikasi_(sessionToken, 'Owner');
    return buatUlangTokenPengguna_(auth.ss, email);
  });
}

function buatUlangTokenPengguna_(ss, email) {
  email = normalisasiEmail_(email);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PENGGUNA);
  const data = bacaData_(sheet, 7);
  const index = data.findIndex(row => normalisasiEmail_(row[0]) === email);
  if (index < 0) throw new Error('Pengguna tidak ditemukan.');
  if (String(data[index][3] || '').toLowerCase() === 'nonaktif') {
    throw new Error('Aktifkan pengguna sebelum membuat token login.');
  }

  const tokenBaru = buatTokenLoginAcak_();
  sheet.getRange(index + 2, 6, 1, 2).setValues([[
    hashTokenLogin_(tokenBaru), new Date()
  ]]);
  cabutAksesSpreadsheet_(ss, email);
  return {
    sukses: true,
    email: email,
    nama: String(data[index][1] || ''),
    tokenBaru: tokenBaru
  };
}

function sinkronisasiAksesPengguna(sessionToken) {
  return denganLock_(function () {
    const auth = autentikasi_(sessionToken, 'Owner');
    const ss = auth.ss;
    const hasil = sinkronisasiAksesPengguna_(ss);
    return {
      sukses: true,
      aktif: hasil.aktif,
      nonaktif: hasil.nonaktif,
      databaseId: ss.getId(),
      databaseNama: ss.getName()
    };
  });
}

function sinkronisasiAksesPengguna_(ss) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PENGGUNA);
  const data = bacaData_(sheet, 7);
  const file = DriveApp.getFileById(ss.getId());
  const emailPemilik = normalisasiEmail_(Session.getEffectiveUser().getEmail());
  let aktif = 0;
  let nonaktif = 0;

  try {
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  } catch (error) {
    // Beberapa Shared Drive atau kebijakan domain dapat menolak perubahan sharing.
  }

  // Database hanya boleh diakses langsung oleh akun deployment Owner.
  // Semua pengguna aplikasi, termasuk Kasir, masuk melalui token aplikasi.
  file.getEditors().forEach(function (pengguna) {
    const email = normalisasiEmail_(pengguna.getEmail());
    if (email && email !== emailPemilik) {
      try {
        file.removeEditor(email);
      } catch (error) {
        // Abaikan bila izin sudah berubah saat proses sinkronisasi.
      }
    }
  });
  file.getViewers().forEach(function (pengguna) {
    const email = normalisasiEmail_(pengguna.getEmail());
    if (email && email !== emailPemilik) {
      try {
        file.removeViewer(email);
      } catch (error) {
        // Abaikan bila izin sudah berubah saat proses sinkronisasi.
      }
    }
  });

  data.forEach(function (row, index) {
    const email = normalisasiEmail_(row[0]);
    if (!email) return;
    const nama = String(row[1] || '').trim() || email;
    const role = String(row[2] || '').trim().toLowerCase() === 'owner' ? 'Owner' : 'Kasir';
    const status = String(row[3] || '').trim().toLowerCase() === 'nonaktif' ? 'Nonaktif' : 'Aktif';
    const dibuatPada = row[4] || new Date();
    const tokenHash = String(row[5] || '');
    const tokenDibuatPada = row[6] || '';

    sheet.getRange(index + 2, 1, 1, 7).setValues([[
      email, nama, role, status, dibuatPada, tokenHash, tokenDibuatPada
    ]]);

    cabutAksesSpreadsheet_(ss, email);
    if (status === 'Aktif') aktif++;
    else nonaktif++;
  });

  return { aktif: aktif, nonaktif: nonaktif };
}

// --- TRANSAKSI KASIR ---

function prosesPembayaranBeban(sessionToken, payload) {
  return denganLock_(function () {
    if (!payload) throw new Error('Data pembayaran beban tidak tersedia.');

    const auth = autentikasi_(sessionToken);
    const ss = auth.ss;

    const daftarAkun = bacaAkun_(ss);
    const akunBeban = daftarAkun.find(item => item.kode === teksWajib_(payload.kodeBeban, 'Akun beban'));
    const akunSumber = daftarAkun.find(item => item.kode === teksWajib_(payload.kodeSumber, 'Sumber pembayaran'));

    if (!akunBeban || !akunBebanDiizinkan_(akunBeban)) {
      throw new Error('Akun beban tidak valid atau merupakan akun HPP.');
    }
    if (!akunSumber || !akunKasBankDiizinkan_(akunSumber)) {
      throw new Error('Sumber pembayaran harus berupa akun Kas atau Bank.');
    }

    const jumlah = angkaPositif_(payload.jumlah, 'Nominal pembayaran');
    const tanggal = tanggalValid_(payload.tanggal);
    const keterangan = teksWajib_(payload.keterangan, 'Keterangan');
    const namaPihak = teksOpsional_(payload.namaPihak, 250);
    const noRef = teksOpsional_(payload.invoice, 50) || 'BEBAN';
    const saldoSumber = hitungSaldoAkunServer_(ss, akunSumber.kode);

    if (saldoSumber + 0.001 < jumlah) {
      throw new Error(
        'Saldo ' + akunSumber.nama + ' tidak mencukupi. Saldo tersedia: ' +
        formatAngkaRupiah_(saldoSumber) + '.'
      );
    }

    const id = 'EXP-' + Date.now();
    const uraian = 'Pembayaran Beban: ' + keterangan;
    const jurnal = [
      [id, tanggal, noRef, uraian, akunBeban.kode, jumlah, 0, namaPihak, '', 'Pembayaran Beban', '', '', ''],
      [id, tanggal, noRef, uraian, akunSumber.kode, 0, jumlah, namaPihak, '', 'Pembayaran Beban', '', '', '']
    ];

    const sheetJurnal = ss.getSheetByName(CONFIG.SHEETS.JURNAL);
    sheetJurnal.getRange(sheetJurnal.getLastRow() + 1, 1, jurnal.length, 13).setValues(jurnal);

    return {
      sukses: true,
      id: id,
      saldoSumberBaru: saldoSumber - jumlah
    };
  });
}

function prosesTransaksiKasir(sessionToken, payload) {
  return denganLock_(function () {
    const tipeValid = ['Penjualan', 'Pembelian', 'Penjualan Kredit', 'Pembelian Kredit'];
    if (!payload || !tipeValid.includes(payload.tipe)) {
      throw new Error('Tipe transaksi tidak valid.');
    }

    const auth = autentikasi_(sessionToken);
    const ss = auth.ss;
    const role = auth.role;
    const penjualan = payload.tipe.indexOf('Penjualan') === 0;
    const kredit = payload.tipe.indexOf('Kredit') >= 0;
    const namaPihak = kredit
      ? teksWajib_(payload.namaPihak, penjualan ? 'Nama pelanggan' : 'Nama pemasok')
      : '';
    const jatuhTempo = kredit ? tanggalValid_(payload.jatuhTempo) : '';
    const invoice = teksOpsional_(payload.invoice, 50);
    const sheetBarang = ss.getSheetByName(CONFIG.SHEETS.BARANG);
    const dataBarang = bacaData_(sheetBarang, 6);
    const sku = teksWajib_(payload.sku, 'SKU');
    const index = dataBarang.findIndex(row => String(row[0]) === sku);
    if (index < 0) throw new Error('Barang tidak ditemukan.');

    const rowBarang = dataBarang[index];
    const qty = angkaPositif_(payload.qty, 'Kuantitas');
    const namaBarang = String(rowBarang[1]);
    const stokLama = angka_(rowBarang[5]);
    const hargaBeliLama = angka_(rowBarang[3]);
    const hargaJualMaster = angkaNonNegatif_(rowBarang[4], 'Harga jual master');
    const hargaSatuan = role === 'Kasir'
      ? (penjualan ? hargaJualMaster : hargaBeliLama)
      : angkaNonNegatif_(payload.hargaSatuan, 'Harga satuan');

    if (penjualan && qty > stokLama) {
      throw new Error('Stok tidak mencukupi. Stok tersedia: ' + stokLama + '.');
    }

    const daftarAkun = bacaAkun_(ss);
    const akun = new Set(daftarAkun.map(item => item.kode));
    const kodeKas = role === 'Kasir'
      ? cariKodeAkun_(daftarAkun, ['kas'], '1000')
      : validasiKodeAkun_(payload.kodeKas, akun, 'akun kas');
    const kodePersediaan = role === 'Kasir'
      ? cariKodeAkun_(daftarAkun, ['persediaan'], '1150')
      : validasiKodeAkun_(payload.kodePersediaan, akun, 'akun persediaan');
    const kodePendapatan = penjualan
      ? (role === 'Kasir'
          ? cariKodeAkun_(daftarAkun, ['pendapatan'], '4000')
          : validasiKodeAkun_(payload.kodePendapatan, akun, 'akun pendapatan'))
      : '';
    const kodeHPP = penjualan
      ? (role === 'Kasir'
          ? cariKodeAkun_(daftarAkun, ['pokok', 'hpp'], '5050')
          : validasiKodeAkun_(payload.kodeHPP, akun, 'akun HPP'))
      : '';

    const kodePiutang = kredit && penjualan
      ? cariKodeAkun_(daftarAkun, ['piutang'], '1100')
      : '';
    const kodeUtang = kredit && !penjualan
      ? cariKodeAkun_(daftarAkun, ['utang usaha'], '2000')
      : '';

    const idPrefix = penjualan ? (kredit ? 'POS-KREDIT-' : 'POS-') : (kredit ? 'BELI-KREDIT-' : 'RESTOCK-');
    const id = idPrefix + Date.now();
    const tanggal = tanggalHariIni_();
    const noRef = invoice || (penjualan
      ? (kredit ? 'POS-KREDIT' : 'POS')
      : (kredit ? 'BELI-KREDIT' : 'RESTOCK'));
    const total = qty * hargaSatuan;
    let stokBaru;
    let hargaBeliBaru = hargaBeliLama;
    let jurnal;

    if (penjualan) {
      stokBaru = stokLama - qty;
      const totalHPP = qty * hargaBeliLama;
      const keterangan = (kredit ? 'Penjualan Kredit: ' : 'Penjualan Tunai: ') + qty + 'x ' + namaBarang;
      const akunPenerimaan = kredit ? kodePiutang : kodeKas;
      jurnal = [
        [id, tanggal, noRef, keterangan, akunPenerimaan, total, 0, namaPihak, jatuhTempo, payload.tipe, sku, qty, ''],
        [id, tanggal, noRef, keterangan, kodePendapatan, 0, total, namaPihak, jatuhTempo, payload.tipe, sku, qty, ''],
        [id, tanggal, noRef, 'HPP ' + keterangan, kodeHPP, totalHPP, 0, namaPihak, jatuhTempo, payload.tipe, sku, qty, ''],
        [id, tanggal, noRef, 'Potong ' + keterangan, kodePersediaan, 0, totalHPP, namaPihak, jatuhTempo, payload.tipe, sku, qty, '']
      ];
    } else {
      stokBaru = stokLama + qty;
      hargaBeliBaru = stokBaru > 0
        ? ((stokLama * hargaBeliLama) + total) / stokBaru
        : hargaSatuan;
      const keterangan = (kredit ? 'Pembelian Kredit: ' : 'Pembelian Tunai: ') + qty + 'x ' + namaBarang;
      const akunPembayaran = kredit ? kodeUtang : kodeKas;
      jurnal = [
        [id, tanggal, noRef, keterangan, kodePersediaan, total, 0, namaPihak, jatuhTempo, payload.tipe, sku, qty, ''],
        [id, tanggal, noRef, keterangan, akunPembayaran, 0, total, namaPihak, jatuhTempo, payload.tipe, sku, qty, '']
      ];
    }

    const sheetJurnal = ss.getSheetByName(CONFIG.SHEETS.JURNAL);
    try {
      sheetBarang.getRange(index + 2, 4, 1, 3).setValues([[
        hargaBeliBaru, rowBarang[4], stokBaru
      ]]);
      sheetJurnal.getRange(sheetJurnal.getLastRow() + 1, 1, jurnal.length, 13).setValues(jurnal);
    } catch (error) {
      sheetBarang.getRange(index + 2, 4, 1, 3).setValues([[
        rowBarang[3], rowBarang[4], rowBarang[5]
      ]]);
      throw error;
    }

    return { sukses: true, id: id, stokBaru: stokBaru };
  });
}

// --- HELPERS ---

function denganLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function bacaData_(sheet, jumlahKolom) {
  const jumlahBaris = sheet.getLastRow() - 1;
  if (jumlahBaris <= 0) return [];
  return sheet.getRange(2, 1, jumlahBaris, jumlahKolom).getValues();
}

function validasiBarang_(barang) {
  const sku = teksWajib_(barang && barang.sku, 'SKU');
  if (!/^[A-Za-z0-9._-]{1,50}$/.test(sku)) {
    throw new Error('SKU hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda minus.');
  }
  return {
    sku: sku,
    nama: teksWajib_(barang && barang.nama, 'Nama barang'),
    kategori: teksWajib_(barang && barang.kategori, 'Kategori barang'),
    hargaBeli: angkaNonNegatif_(barang && barang.hargaBeli, 'Harga beli'),
    hargaJual: angkaNonNegatif_(barang && barang.hargaJual, 'Harga jual'),
    stok: angkaNonNegatif_(barang && barang.stok, 'Stok')
  };
}

function dapatkanInfoStokTransaksi_(ss, transaksi) {
  const barisUtama = transaksi.find(row =>
    !/^(HPP |Potong )/i.test(String(row[3] || ''))
  ) || transaksi[0];
  const jenis = String(barisUtama[9] || '');
  const id = String(barisUtama[0] || '');
  const penjualan = jenis.indexOf('Penjualan') === 0 || /^POS-/i.test(id);
  const pembelian = jenis.indexOf('Pembelian') === 0 || /^(RESTOCK-|BELI-KREDIT-)/i.test(id);
  if (!penjualan && !pembelian) return null;

  let sku = String(barisUtama[10] || '');
  let qty = angka_(barisUtama[11]);

  if (!sku || qty <= 0) {
    const cocok = String(barisUtama[3] || '').match(/:\s*([0-9]+(?:[.,][0-9]+)?)x\s+(.+)$/i);
    if (!cocok) {
      throw new Error('Data SKU/qty transaksi lama tidak dapat dikenali dengan aman.');
    }
    qty = Number(cocok[1].replace(',', '.'));
    const namaBarang = cocok[2].trim().toLowerCase();
    const barangCocok = bacaBarang_(ss).filter(item =>
      item.nama.trim().toLowerCase() === namaBarang
    );
    if (barangCocok.length !== 1) {
      throw new Error('Barang transaksi lama tidak dapat ditentukan secara unik.');
    }
    sku = barangCocok[0].sku;
  }

  const totalPembelian = pembelian
    ? transaksi.reduce((total, row) => total + angka_(row[5]), 0)
    : 0;

  return {
    sku: sku,
    qty: angkaPositif_(qty, 'Qty transaksi'),
    penjualan: penjualan,
    totalPembelian: totalPembelian
  };
}

function akunBebanDiizinkan_(akun) {
  const nama = String(akun && akun.nama || '').toLowerCase();
  return akun && akun.kategori === 'Beban' &&
    akun.kode !== '5050' &&
    !nama.includes('harga pokok') &&
    !/(^|\W)hpp(\W|$)/i.test(nama);
}

function akunKasBankDiizinkan_(akun) {
  const nama = String(akun && akun.nama || '').toLowerCase();
  return akun && akun.kategori === 'Harta Lancar' &&
    (nama.includes('kas') || nama.includes('bank'));
}

function batasiAkunTransaksi_(daftarAkun) {
  return daftarAkun
    .filter(item => akunBebanDiizinkan_(item) || akunKasBankDiizinkan_(item))
    .map(item => ({
      kode: item.kode,
      nama: item.nama,
      kategori: item.kategori,
      saldoAwal: item.saldoAwal
    }));
}

function hitungSaldoAkunServer_(ss, kodeAkun) {
  const akun = bacaAkun_(ss).find(item => item.kode === kodeAkun);
  if (!akun) throw new Error('Akun sumber pembayaran tidak ditemukan.');

  const normalDebet = ['Harta Lancar', 'Harta Tetap', 'Beban', 'Aset'].includes(akun.kategori);
  return bacaData_(ss.getSheetByName(CONFIG.SHEETS.JURNAL), 10)
    .filter(row => String(row[4]) === kodeAkun)
    .reduce(function (saldo, row) {
      const debet = angka_(row[5]);
      const kredit = angka_(row[6]);
      return saldo + (normalDebet ? debet - kredit : kredit - debet);
    }, angka_(akun.saldoAwal));
}

function formatAngkaRupiah_(nilai) {
  return 'Rp ' + Math.round(angka_(nilai)).toLocaleString('id-ID');
}

function normalisasiEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function aktifkanBootstrapOwner_(ss, tokenHash) {
  const properties = PropertiesService.getScriptProperties();
  const bootstrap = properties.getProperty('OWNER_BOOTSTRAP_TOKEN') || '';
  if (!bootstrap || hashTokenLogin_(bootstrap) !== tokenHash) return null;

  const emailOwner = normalisasiEmail_(Session.getEffectiveUser().getEmail());
  pastikanOwnerMigrasi_(ss, emailOwner);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PENGGUNA);
  const data = bacaData_(sheet, 7);
  const index = data.findIndex(row => normalisasiEmail_(row[0]) === emailOwner);
  if (index < 0) throw new Error('Akun Owner tidak dapat disiapkan.');

  sheet.getRange(index + 2, 1, 1, 7).setValues([[
    emailOwner,
    String(data[index][1] || 'Pemilik'),
    'Owner',
    'Aktif',
    data[index][4] || new Date(),
    tokenHash,
    new Date()
  ]]);
  properties.deleteProperty('OWNER_BOOTSTRAP_TOKEN');
  return bacaPenggunaInternal_(ss).find(item => item.email === emailOwner) || null;
}

function buatTokenLoginAcak_() {
  const bagian = [
    Utilities.getUuid().replace(/-/g, '').slice(0, 8),
    Utilities.getUuid().replace(/-/g, '').slice(0, 8),
    Utilities.getUuid().replace(/-/g, '').slice(0, 8)
  ];
  return 'SOF-' + bagian.join('-').toUpperCase();
}

function hashTokenLogin_(token) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(token || '').trim().toUpperCase(),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '');
}

function autentikasi_(sessionToken, roleWajib) {
  sessionToken = teksWajib_(sessionToken, 'Sesi login');
  const cache = CacheService.getScriptCache();
  const key = keySesi_(sessionToken);
  const tersimpan = cache.get(key);
  if (!tersimpan) throw new Error('Sesi login berakhir. Silakan login kembali.');

  let sesi;
  try {
    sesi = JSON.parse(tersimpan);
  } catch (error) {
    cache.remove(key);
    throw new Error('Sesi login tidak valid.');
  }

  const ss = bukaSpreadsheetUtama_();
  const pengguna = bacaPenggunaInternal_(ss).find(item =>
    item.email === normalisasiEmail_(sesi.email) && item.status === 'Aktif'
  );
  if (!pengguna) throw new Error('Akses ditolak. Pengguna tidak aktif atau tidak ditemukan.');
  if (!sesi.tokenHash || pengguna.tokenHash !== sesi.tokenHash) {
    cache.remove(key);
    throw new Error('Sesi login berakhir karena token pengguna telah diganti.');
  }
  if (roleWajib && pengguna.role !== roleWajib) {
    throw new Error('Akses ditolak. Fitur ini hanya dapat digunakan oleh ' + roleWajib + '.');
  }

  cache.put(key, tersimpan, CONFIG.SESSION_TTL_SECONDS);
  return {
    ss: ss,
    email: pengguna.email,
    nama: pengguna.nama,
    role: pengguna.role
  };
}

function keySesi_(sessionToken) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(sessionToken),
    Utilities.Charset.UTF_8
  );
  return 'SOF_SESSION_' + Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '');
}

function cabutAksesSpreadsheet_(ss, email) {
  email = normalisasiEmail_(email);
  if (!email) return;
  const emailPemilik = normalisasiEmail_(Session.getEffectiveUser().getEmail());
  if (email === emailPemilik) return;
  const file = DriveApp.getFileById(ss.getId());
  try {
    file.removeEditor(email);
  } catch (error) {
    // Pengguna mungkin sudah bukan editor.
  }
  try {
    file.removeViewer(email);
  } catch (error) {
    // Pengguna mungkin sudah bukan viewer.
  }
}

function dapatkanPenggunaAktif_(ss, email) {
  email = normalisasiEmail_(email);
  return bacaPengguna_(ss).find(item => item.email === email && item.status === 'Aktif') || null;
}

function pastikanPenggunaAktif_(ss, email) {
  const pengguna = dapatkanPenggunaAktif_(ss, email);
  if (!pengguna) {
    throw new Error('Akses ditolak. Email ini tidak terdaftar atau sudah nonaktif pada usaha.');
  }
  return pengguna;
}

function pastikanOwnerMigrasi_(ss, email) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PENGGUNA);
  const data = bacaData_(sheet, 7);
  email = normalisasiEmail_(email);
  const index = data.findIndex(row => normalisasiEmail_(row[0]) === email);
  if (index < 0) {
    sheet.appendRow([email, 'Pemilik', 'Owner', 'Aktif', new Date(), '', '']);
  } else {
    sheet.getRange(index + 2, 1, 1, 7).setValues([[
      email,
      String(data[index][1] || 'Pemilik'),
      'Owner',
      'Aktif',
      data[index][4] || new Date(),
      String(data[index][5] || ''),
      data[index][6] || ''
    ]]);
  }
}

function validasiKodeAkun_(kode, akun, label) {
  kode = teksWajib_(kode, label);
  if (!akun.has(kode)) throw new Error(label + ' tidak ditemukan dalam daftar akun.');
  return kode;
}

function cariKodeAkun_(daftarAkun, kataKunci, kodeFallback) {
  const ditemukan = daftarAkun.find(item => {
    const nama = String(item.nama || '').toLowerCase();
    return kataKunci.some(kata => nama.includes(kata));
  });
  if (ditemukan) return ditemukan.kode;
  const fallback = daftarAkun.find(item => item.kode === kodeFallback);
  if (fallback) return fallback.kode;
  throw new Error('Akun sistem yang diperlukan tidak ditemukan. Hubungi Owner.');
}

function teksWajib_(nilai, label) {
  const hasil = String(nilai == null ? '' : nilai).trim();
  if (!hasil) throw new Error(label + ' wajib diisi.');
  if (hasil.length > 250) throw new Error(label + ' terlalu panjang.');
  return hasil;
}

function teksOpsional_(nilai, batas) {
  return String(nilai == null ? '' : nilai).trim().slice(0, batas || 250);
}

function angka_(nilai) {
  const angka = Number(nilai);
  return Number.isFinite(angka) ? angka : 0;
}

function angkaNonNegatif_(nilai, label) {
  const angka = Number(nilai);
  if (!Number.isFinite(angka) || angka < 0) {
    throw new Error(label + ' harus berupa angka nol atau lebih.');
  }
  return angka;
}

function angkaPositif_(nilai, label) {
  const angka = Number(nilai);
  if (!Number.isFinite(angka) || angka <= 0) {
    throw new Error(label + ' harus lebih besar dari nol.');
  }
  return angka;
}

function tanggalValid_(nilai) {
  const teks = String(nilai || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(teks) || isNaN(new Date(teks + 'T00:00:00').getTime())) {
    throw new Error('Tanggal tidak valid.');
  }
  return teks;
}

function tanggalHariIni_() {
  return Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM-dd');
}

function formatTanggal_(nilai) {
  if (nilai instanceof Date) {
    return Utilities.formatDate(nilai, CONFIG.TIME_ZONE, 'yyyy-MM-dd');
  }
  return String(nilai || '');
}
