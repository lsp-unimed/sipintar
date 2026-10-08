/**
 * SIPINTAR LSP UNIMED — Backend Google Apps Script
 * Sistem Informasi Pemantauan dan Layanan Terintegrasi LSP Universitas Negeri Medan
 *
 * Mengacu SOP Pelayanan Kegiatan Sertifikasi (XVII/SOP-PKS, Rev. 03/00):
 *  1 Pelayanan Informasi Sertifikasi      6 Pelaksanaan Pelayanan Sertifikasi
 *  2 Penerimaan Permohonan Sertifikasi    7 Penyampaian Hasil Sertifikasi
 *  3 Verifikasi Persyaratan Peserta       8 Penyerahan Sertifikat Kompetensi
 *  4 Penjadwalan Sertifikasi              9 Penanganan Keluhan Pelayanan
 *  5 Pelayanan Administrasi Asesmen      10 Pengendalian Rekaman Pelayanan
 *
 * CARA PASANG (ringkas — lengkapnya di README.md):
 *  1. Buat Google Spreadsheet baru → Ekstensi → Apps Script → tempel file ini.
 *  2. Jalankan fungsi setup() sekali. Password admin awal muncul di Log Eksekusi.
 *  3. Terapkan → Deployment baru → Aplikasi web → Jalankan sebagai: Saya,
 *     Akses: Siapa saja. Salin URL /exec ke assets/js/config.js (API_URL).
 */

const CONFIG = {
  SPREADSHEET_ID: '',      // kosongkan jika skrip terikat (dibuat dari menu Ekstensi spreadsheet)
  UPLOAD_FOLDER_ID: '',    // kosongkan → folder "SIPINTAR_UPLOADS" dibuat otomatis di Drive pemilik
  MAX_FILE_MB: 2,          // batas ukuran per berkas unggahan
  SESSION_SECONDS: 21600,  // 6 jam (batas maksimum CacheService)
  TZ: 'Asia/Jakarta'
};

/* ============================ STRUKTUR DATA ============================ */

const SHEETS = {
  Pengaturan: ['kunci', 'nilai', 'keterangan'],
  Skema: ['id_skema', 'kode_skema', 'nama_skema', 'jenis_skema', 'jumlah_unit', 'persyaratan', 'biaya', 'link_dokumen', 'status'],
  TUK: ['id_tuk', 'nama_tuk', 'jenis_tuk', 'alamat', 'penanggung_jawab', 'kontak', 'status'],
  Asesor: ['id_asesor', 'nama_asesor', 'no_reg_met', 'skema', 'email', 'hp', 'status'],
  Jadwal: ['id_jadwal', 'id_skema', 'tanggal', 'waktu', 'id_tuk', 'kuota', 'batas_daftar', 'status', 'keterangan'],
  Pendaftaran: ['no_reg', 'waktu_daftar', 'id_jadwal', 'id_skema', 'nama', 'nik', 'nim', 'tempat_lahir', 'tanggal_lahir',
    'jenis_kelamin', 'email', 'hp', 'alamat', 'instansi', 'pendidikan', 'pekerjaan', 'tujuan_asesmen',
    'file_ktp', 'file_foto', 'file_ijazah', 'file_apl02', 'file_pendukung',
    'status_verifikasi', 'catatan_verifikasi', 'tgl_verifikasi',
    'status_jadwal', 'id_asesor', 'id_tuk', 'tanggal_asesmen', 'waktu_asesmen',
    'status_asesmen', 'catatan_asesmen',
    'rekomendasi', 'tgl_hasil', 'link_surat_hasil', 'catatan_hasil',
    'status_sertifikat', 'no_sertifikat', 'tgl_serah', 'penerima', 'diperbarui',
    'file_apl01', 'status_kelengkapan', 'catatan_kelengkapan', 'cek_berkas', 'tgl_kelengkapan',
    'verifikasi_langsung', 'cek_persyaratan', 'rekomendasi_apl01'],
  Keluhan: ['no_tiket', 'waktu', 'nama', 'email', 'hp', 'no_reg', 'kategori', 'isi', 'status', 'tindak_lanjut', 'tgl_selesai', 'petugas'],
  Layanan: ['no_layanan', 'waktu', 'jenis', 'nama', 'email', 'hp', 'no_reg', 'no_sertifikat', 'skema', 'keterangan', 'file', 'status', 'catatan_petugas', 'tgl_selesai', 'petugas'],
  Survei: ['waktu', 'no_reg', 'skor_informasi', 'skor_administrasi', 'skor_asesmen', 'skor_petugas', 'skor_keseluruhan', 'saran'],
  Dokumen: ['id_dok', 'nomor', 'judul', 'kategori', 'id_skema', 'link', 'status'],
  Log: ['waktu', 'aktor', 'peran', 'langkah_sop', 'aksi', 'ref', 'detail'],
  Pengguna: ['username', 'nama', 'peran', 'salt', 'password_hash', 'aktif']
};

const KEY = { Pengaturan: 'kunci', Skema: 'id_skema', TUK: 'id_tuk', Asesor: 'id_asesor', Jadwal: 'id_jadwal',
  Pendaftaran: 'no_reg', Keluhan: 'no_tiket', Layanan: 'no_layanan', Dokumen: 'id_dok', Pengguna: 'username' };

const ID_PREFIX = { Skema: 'SKM', TUK: 'TUK', Asesor: 'ASR', Jadwal: 'JDW', Dokumen: 'DOK' };

const MASTER_SHEETS = ['Skema', 'TUK', 'Asesor', 'Jadwal', 'Dokumen', 'Pengaturan'];
const READABLE_SHEETS = MASTER_SHEETS.concat(['Keluhan', 'Layanan', 'Survei', 'Log']);

const PERAN = ['Admin', 'Sekretariat LSP', 'Bagian Administrasi', 'Bagian Sertifikasi', 'Bagian Manajemen Mutu'];

const ST = {
  VERIF: ['Menunggu Verifikasi', 'Memenuhi Syarat', 'Perlu Perbaikan', 'Tidak Memenuhi Syarat'],
  LENGKAP: ['Menunggu Pemeriksaan', 'Lengkap', 'Belum Lengkap'],
  JADWAL: ['Belum Dijadwalkan', 'Terjadwal'],
  ASESMEN: ['Belum', 'Dokumen Siap', 'Hadir', 'Tidak Hadir', 'Selesai'],
  REKOM: ['', 'Kompeten', 'Belum Kompeten'],
  SERT: ['Belum Terbit', 'Diajukan ke BNSP', 'Siap Diambil', 'Sudah Diserahkan'],
  TIKET: ['Diterima', 'Diproses', 'Selesai', 'Ditolak'],
  LAYANAN: { 'Banding Asesmen': 'BDG', 'Surveilans': 'SRV', 'Legalisir Sertifikat': 'LGL', 'Perpanjangan Sertifikat (RCC)': 'RCC' }
};

const PUBLIC_SETTINGS = ['nama_lsp', 'nama_singkat', 'tagline', 'deskripsi', 'nomor_lisensi', 'alamat', 'email', 'telepon',
  'whatsapp', 'jam_layanan', 'pengumuman', 'link_template_apl02', 'info_pengambilan_sertifikat', 'info_verifikasi_langsung',
  'link_contoh_apl01', 'link_contoh_apl02'];

/* ================================ ROUTER ================================ */

function doGet(e) {
  const p = (e && e.parameter) || {};
  return out_(route_(p.action || 'ping', p, p.token));
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: 'Format permintaan tidak valid.' }); }
  return out_(route_(body.action, body.data || {}, body.token));
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function route_(action, data, token) {
  try {
    if (PUBLIC[action]) return { ok: true, data: PUBLIC[action](data) };
    const a = ADMIN[action];
    if (a) {
      const user = auth_(token);
      if (a.roles && user.peran !== 'Admin' && a.roles.indexOf(user.peran) < 0) {
        throw new Error('Peran Anda (' + user.peran + ') tidak berwenang untuk aksi ini.');
      }
      return { ok: true, data: a.fn(data, Object.assign({ _token: token }, user)) };
    }
    throw new Error('Aksi tidak dikenal: ' + action);
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/* ============================ LAYANAN PUBLIK ============================ */

const PUBLIC = {
  ping: () => ({ pesan: 'SIPINTAR LSP UNIMED aktif', waktu: now_() }),

  /** Langkah 1 — Pelayanan Informasi: semua data publik dalam satu panggilan. */
  publicData: () => {
    const cache = CacheService.getScriptCache();
    const hit = cache.get('publicData');
    if (hit) return JSON.parse(hit);

    const set = settings_();
    const pengaturan = {};
    PUBLIC_SETTINGS.forEach(k => pengaturan[k] = set[k] || '');

    const skema = rows_('Skema').filter(r => r.status !== 'Nonaktif').map(strip_);
    const tuk = rows_('TUK').filter(r => r.status !== 'Nonaktif')
      .map(r => ({ id_tuk: r.id_tuk, nama_tuk: r.nama_tuk, jenis_tuk: r.jenis_tuk, alamat: r.alamat }));
    const asesor = rows_('Asesor').filter(r => r.status !== 'Nonaktif');
    const daftar = rows_('Pendaftaran');
    const mapSkema = index_(skema, 'id_skema');
    const mapTuk = index_(tuk, 'id_tuk');

    const terisi = {};
    daftar.forEach(r => { if (r.status_verifikasi !== 'Tidak Memenuhi Syarat') terisi[r.id_jadwal] = (terisi[r.id_jadwal] || 0) + 1; });

    const jadwal = rows_('Jadwal').map(r => {
      const kuota = Number(r.kuota) || 0;
      const isi = terisi[r.id_jadwal] || 0;
      const out = Object.assign(strip_(r), {
        nama_skema: (mapSkema[r.id_skema] || {}).nama_skema || r.id_skema,
        kode_skema: (mapSkema[r.id_skema] || {}).kode_skema || '',
        nama_tuk: (mapTuk[r.id_tuk] || {}).nama_tuk || r.id_tuk,
        bisa_daftar: jadwalBuka_(r, isi)
      });
      delete out.kuota; // kuota tidak ditampilkan ke publik
      return out;
    }).sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));

    const dokumen = rows_('Dokumen').filter(r => r.status !== 'Nonaktif').map(strip_);

    const res = {
      pengaturan, skema, tuk, jadwal, dokumen,
      statistik: {
        skema: skema.length,
        tuk: tuk.length,
        asesor: asesor.length,
        asesi: daftar.length,
        kompeten: daftar.filter(r => r.rekomendasi === 'Kompeten').length
      }
    };
    cache.put('publicData', JSON.stringify(res), 600); // 10 menit; dihapus otomatis setiap ada perubahan data
    return res;
  },

  /** Langkah 2 — Penerimaan Permohonan Sertifikasi (APL-01 + persyaratan). */
  daftar: (d) => {
    const wajib = ['id_jadwal', 'nama', 'nik', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'email', 'hp', 'alamat', 'pendidikan', 'tujuan_asesmen'];
    wajib.forEach(k => { if (!String(d[k] || '').trim()) throw new Error('Kolom "' + k.replace(/_/g, ' ') + '" wajib diisi.'); });
    if (!/^\d{16}$/.test(String(d.nik).trim())) throw new Error('NIK harus 16 digit angka.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.email).trim())) throw new Error('Format email tidak valid.');
    if (!d.setuju) throw new Error('Anda harus menyetujui pernyataan pendaftaran.');
    if (!d.setuju_persyaratan) throw new Error('Centang pernyataan bahwa Anda memenuhi persyaratan skema.');

    return withLock_(() => {
      const jadwal = rows_('Jadwal').find(r => r.id_jadwal === d.id_jadwal);
      if (!jadwal) throw new Error('Jadwal tidak ditemukan.');
      const daftar = rows_('Pendaftaran');
      const isi = daftar.filter(r => r.id_jadwal === d.id_jadwal && r.status_verifikasi !== 'Tidak Memenuhi Syarat').length;
      if (!jadwalBuka_(jadwal, isi)) throw new Error('Pendaftaran untuk jadwal ini sudah ditutup atau kuota penuh.');
      const dobel = daftar.find(r => r.id_jadwal === d.id_jadwal && String(r.nik) === String(d.nik).trim() && r.status_verifikasi !== 'Tidak Memenuhi Syarat');
      if (dobel) throw new Error('NIK ini sudah terdaftar pada jadwal yang sama (No. Registrasi ' + dobel.no_reg + ').');

      const noReg = nextId_('REG', 'LSPU-' + Utilities.formatDate(new Date(), CONFIG.TZ, 'yyMM') + '-', 4);
      const files = d.files || {};
      const simpan = {};
      ['file_apl01', 'file_ktp', 'file_foto', 'file_ijazah', 'file_apl02', 'file_pendukung'].forEach(k => {
        if (files[k]) simpan[k] = saveFile_(files[k], noReg, k.replace('file_', ''));
      });
      if (!simpan.file_ktp) throw new Error('Scan KTP wajib diunggah.');
      if (!simpan.file_foto) throw new Error('Pas foto wajib diunggah.');
      if (!simpan.file_apl01) throw new Error('APL-01 yang telah diisi dan ditandatangani wajib diunggah.');

      const row = {
        no_reg: noReg, waktu_daftar: now_(), id_jadwal: jadwal.id_jadwal, id_skema: jadwal.id_skema,
        status_kelengkapan: 'Menunggu Pemeriksaan',
        status_verifikasi: 'Menunggu Verifikasi', status_jadwal: 'Belum Dijadwalkan',
        status_asesmen: 'Belum', rekomendasi: '', status_sertifikat: 'Belum Terbit', diperbarui: now_()
      };
      ['nama', 'nik', 'nim', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'email', 'hp', 'alamat', 'instansi',
        'pendidikan', 'pekerjaan', 'tujuan_asesmen'].forEach(k => row[k] = String(d[k] || '').trim());
      row.email = row.email.toLowerCase();
      Object.assign(row, simpan);
      append_('Pendaftaran', row);
      log_({ username: 'publik', peran: 'Pemohon' }, 2, 'Permohonan sertifikasi diterima (APL-01)', noReg,
        'Jadwal ' + jadwal.id_jadwal + ' · ' + Object.keys(simpan).length + ' berkas');
      invalidate_();
      const sk = rows_('Skema').find(x => x.id_skema === jadwal.id_skema) || {};
      const tk = rows_('TUK').find(x => x.id_tuk === jadwal.id_tuk) || {};
      const bukti = {
        no_reg: noReg, nama: row.nama, nik: row.nik.slice(0, 4) + '********' + row.nik.slice(-4), email: row.email, hp: row.hp,
        skema: sk.nama_skema || jadwal.id_skema, kode_skema: sk.kode_skema || '', tanggal: jadwal.tanggal, waktu: jadwal.waktu,
        tuk: tk.nama_tuk || '', waktu_daftar: row.waktu_daftar, status_verifikasi: row.status_verifikasi
      };
      bukti.email_terkirim = notify_(row.email, 'Bukti pendaftaran uji kompetensi ' + noReg, buktiHtml_(bukti));
      return bukti;
    });
  },

  /** Pelacakan status oleh peserta (langkah 3–8). Butuh No. Registrasi + email. */
  lacak: (d) => {
    const r = cariPeserta_(d.no_reg, d.email);
    return publicView_(r);
  },

  /** Unggah ulang berkas oleh asesi saat berkas belum lengkap / perlu perbaikan (kembali ke pemeriksaan L2). */
  unggahUlang: (d) => {
    const r = cariPeserta_(d.no_reg, d.email);
    if (r.status_kelengkapan !== 'Belum Lengkap' && r.status_verifikasi !== 'Perlu Perbaikan') throw new Error('Unggah ulang hanya bisa dilakukan bila berkas dinyatakan belum lengkap atau perlu perbaikan.');
    const files = d.files || {};
    return withLock_(() => {
      const patch = {};
      ['file_apl01', 'file_ktp', 'file_foto', 'file_ijazah', 'file_apl02', 'file_pendukung'].forEach(k => {
        if (files[k]) patch[k] = saveFile_(files[k], r.no_reg, k.replace('file_', '') + '_ulang_' + Utilities.formatDate(new Date(), CONFIG.TZ, 'yyMMddHHmm'));
      });
      if (!Object.keys(patch).length) throw new Error('Pilih minimal satu berkas untuk diunggah ulang.');
      Object.assign(patch, { status_kelengkapan: 'Menunggu Pemeriksaan', status_verifikasi: 'Menunggu Verifikasi', diperbarui: now_() });
      update_('Pendaftaran', r.no_reg, patch);
      log_({ username: 'publik', nama: r.nama, peran: 'Pemohon' }, 2, 'Unggah ulang berkas persyaratan', r.no_reg,
        Object.keys(patch).filter(k => k.indexOf('file_') === 0).map(k => k.replace('file_', '')).join(', '));
      return { ok: true };
    });
  },

  /** Plotting jadwal, asesor & TUK yang sudah ditetapkan (nama disamarkan). */
  plotting: () => {
    const mapS = index_(rows_('Skema'), 'id_skema');
    const mapT = index_(rows_('TUK'), 'id_tuk');
    const mapA = index_(rows_('Asesor'), 'id_asesor');
    const mapJ = index_(rows_('Jadwal'), 'id_jadwal');
    return rows_('Pendaftaran').filter(r => r.status_jadwal === 'Terjadwal').map(r => ({
      no_reg: r.no_reg,
      nama: mask_(r.nama),
      id_jadwal: r.id_jadwal,
      jadwal_label: jadwalLabel_(mapJ[r.id_jadwal], mapS),
      skema: (mapS[r.id_skema] || {}).nama_skema || r.id_skema,
      tanggal: r.tanggal_asesmen || (mapJ[r.id_jadwal] || {}).tanggal || '',
      waktu: r.waktu_asesmen || (mapJ[r.id_jadwal] || {}).waktu || '',
      tuk: (mapT[r.id_tuk] || {}).nama_tuk || r.id_tuk,
      asesor: (mapA[r.id_asesor] || {}).nama_asesor || r.id_asesor
    }));
  },

  /** Langkah 9 — Penanganan Keluhan Pelayanan. */
  keluhan: (d) => {
    ['nama', 'email', 'kategori', 'isi'].forEach(k => { if (!String(d[k] || '').trim()) throw new Error('Kolom "' + k + '" wajib diisi.'); });
    return withLock_(() => {
      const no = nextId_('KLH', 'KLH-' + Utilities.formatDate(new Date(), CONFIG.TZ, 'yyMM') + '-', 3);
      append_('Keluhan', {
        no_tiket: no, waktu: now_(), nama: d.nama, email: String(d.email).toLowerCase().trim(), hp: d.hp || '',
        no_reg: d.no_reg || '', kategori: d.kategori, isi: d.isi, status: 'Diterima'
      });
      log_({ username: 'publik', peran: 'Pemohon' }, 9, 'Keluhan diterima dan dicatat', no, d.kategori);
      return { no_tiket: no };
    });
  },

  /** Layanan pasca-sertifikasi: Banding, Surveilans, Legalisir, Perpanjangan (RCC). */
  layanan: (d) => {
    const prefix = ST.LAYANAN[d.jenis];
    if (!prefix) throw new Error('Jenis layanan tidak dikenal.');
    ['nama', 'email', 'hp'].forEach(k => { if (!String(d[k] || '').trim()) throw new Error('Kolom "' + k + '" wajib diisi.'); });
    if (d.jenis === 'Banding Asesmen') {
      cariPeserta_(d.no_reg, d.email); // banding hanya untuk peserta terdaftar
      if (!String(d.keterangan || '').trim()) throw new Error('Alasan banding wajib diisi.');
    }
    return withLock_(() => {
      const no = nextId_(prefix, prefix + '-' + Utilities.formatDate(new Date(), CONFIG.TZ, 'yyMM') + '-', 3);
      const file = d.file ? saveFile_(d.file, no, 'lampiran') : '';
      append_('Layanan', {
        no_layanan: no, waktu: now_(), jenis: d.jenis, nama: d.nama, email: String(d.email).toLowerCase().trim(),
        hp: d.hp, no_reg: d.no_reg || '', no_sertifikat: d.no_sertifikat || '', skema: d.skema || '',
        keterangan: d.keterangan || '', file: file, status: 'Diterima'
      });
      log_({ username: 'publik', peran: 'Pemohon' }, d.jenis === 'Banding Asesmen' ? 7 : 1, 'Permohonan ' + d.jenis + ' diterima', no, d.no_reg || d.no_sertifikat || '');
      return { no_layanan: no };
    });
  },

  /** Lacak tiket keluhan atau layanan. */
  cekTiket: (d) => {
    const no = String(d.no || '').trim().toUpperCase();
    const email = String(d.email || '').trim().toLowerCase();
    let r = rows_('Keluhan').find(x => x.no_tiket === no);
    if (r) {
      if (r.email !== email) throw new Error('Email tidak sesuai dengan tiket.');
      return { no: r.no_tiket, jenis: 'Keluhan: ' + r.kategori, waktu: r.waktu, status: r.status, tanggapan: r.tindak_lanjut, selesai: r.tgl_selesai, isi: r.isi };
    }
    r = rows_('Layanan').find(x => x.no_layanan === no);
    if (r) {
      if (r.email !== email) throw new Error('Email tidak sesuai dengan tiket.');
      return { no: r.no_layanan, jenis: r.jenis, waktu: r.waktu, status: r.status, tanggapan: r.catatan_petugas, selesai: r.tgl_selesai, isi: r.keterangan };
    }
    throw new Error('Nomor tiket tidak ditemukan.');
  },

  /** Survei kepuasan pemohon (tujuan SOP: meningkatkan kepuasan). */
  survei: (d) => {
    const s = ['skor_informasi', 'skor_administrasi', 'skor_asesmen', 'skor_petugas', 'skor_keseluruhan'];
    s.forEach(k => { const v = Number(d[k]); if (!(v >= 1 && v <= 5)) throw new Error('Semua penilaian wajib diisi (1–5).'); });
    const row = { waktu: now_(), no_reg: d.no_reg || '', saran: d.saran || '' };
    s.forEach(k => row[k] = Number(d[k]));
    append_('Survei', row);
    return { terima_kasih: true };
  },

  /** Login admin. */
  login: (d) => {
    const u = String(d.username || '').trim().toLowerCase();
    const cache = CacheService.getScriptCache();
    const failKey = 'fail_' + u;
    const fails = Number(cache.get(failKey) || 0);
    if (fails >= 5) throw new Error('Terlalu banyak percobaan gagal. Coba lagi 10 menit lagi.');
    const user = rows_('Pengguna').find(r => String(r.username).toLowerCase() === u);
    if (!user || String(user.aktif).toUpperCase() === 'TIDAK' || hash_(d.password || '', user.salt) !== user.password_hash) {
      cache.put(failKey, String(fails + 1), 600);
      throw new Error('Username atau password salah.');
    }
    cache.remove(failKey);
    const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
    const sess = { username: user.username, nama: user.nama, peran: user.peran };
    cache.put('sess_' + token, JSON.stringify(sess), CONFIG.SESSION_SECONDS);
    log_(sess, 10, 'Login admin', user.username, '');
    return { token: token, user: sess };
  }
};

/* ============================ LAYANAN ADMIN ============================ */

const ADMIN = {
  me: { fn: (d, u) => ({ username: u.username, nama: u.nama, peran: u.peran }) },

  logout: { fn: (d, u) => { CacheService.getScriptCache().remove('sess_' + u._token); return true; } },

  /** Ringkasan dasbor admin. */
  summary: {
    fn: () => {
      const p = rows_('Pendaftaran');
      const c = (f) => p.filter(f).length;
      const kel = rows_('Keluhan');
      const lay = rows_('Layanan');
      const sv = rows_('Survei');
      const avg = (k) => sv.length ? (sv.reduce((a, r) => a + Number(r[k] || 0), 0) / sv.length) : 0;
      const logs = rows_('Log').slice(-20).reverse();
      return {
        total: p.length,
        menunggu_kelengkapan: c(r => (r.status_kelengkapan || 'Menunggu Pemeriksaan') !== 'Lengkap' && r.status_verifikasi !== 'Tidak Memenuhi Syarat'),
        menunggu_verifikasi: c(r => r.status_kelengkapan === 'Lengkap' && (r.status_verifikasi === 'Menunggu Verifikasi' || r.status_verifikasi === 'Perlu Perbaikan')),
        perlu_perbaikan: c(r => r.status_verifikasi === 'Perlu Perbaikan'),
        siap_dijadwalkan: c(r => r.status_verifikasi === 'Memenuhi Syarat' && r.status_jadwal !== 'Terjadwal'),
        terjadwal: c(r => r.status_jadwal === 'Terjadwal' && !r.rekomendasi),
        kompeten: c(r => r.rekomendasi === 'Kompeten'),
        belum_kompeten: c(r => r.rekomendasi === 'Belum Kompeten'),
        sertifikat_proses: c(r => r.rekomendasi === 'Kompeten' && r.status_sertifikat !== 'Sudah Diserahkan'),
        sertifikat_diserahkan: c(r => r.status_sertifikat === 'Sudah Diserahkan'),
        keluhan_terbuka: kel.filter(r => r.status !== 'Selesai' && r.status !== 'Ditolak').length,
        layanan_terbuka: lay.filter(r => r.status !== 'Selesai' && r.status !== 'Ditolak').length,
        survei_n: sv.length,
        survei_rata: Math.round(avg('skor_keseluruhan') * 100) / 100,
        logs: logs
      };
    }
  },

  /** Data referensi panel admin dalam satu panggilan (lebih cepat). */
  refData: { fn: () => ({ Skema: rows_('Skema').map(strip_), TUK: rows_('TUK').map(strip_), Asesor: rows_('Asesor').map(strip_), Jadwal: rows_('Jadwal').map(strip_) }) },

  /** Daftar pendaftar lengkap untuk admin. */
  listPendaftar: { fn: () => rows_('Pendaftaran').map(strip_).reverse() },

  /** Detail satu peserta beserta rekaman pelayanannya (langkah 10). */
  detailPendaftar: {
    fn: (d) => {
      const r = rows_('Pendaftaran').find(x => x.no_reg === d.no_reg);
      if (!r) throw new Error('Data tidak ditemukan.');
      const logs = rows_('Log').filter(l => l.ref === d.no_reg);
      const lay = rows_('Layanan').filter(l => l.no_reg === d.no_reg).map(strip_);
      const kel = rows_('Keluhan').filter(l => l.no_reg === d.no_reg).map(strip_);
      return { data: strip_(r), logs: logs, layanan: lay, keluhan: kel };
    }
  },

  /**
   * Pembaruan tahapan untuk satu atau beberapa peserta.
   * d = { no_regs: [..], tahap: 'verifikasi'|'plotting'|'asesmen'|'hasil'|'sertifikat'|'data', nilai: {...} }
   */
  updatePendaftar: {
    fn: (d, u) => {
      const T = TAHAP[d.tahap];
      if (!T) throw new Error('Tahap tidak dikenal.');
      if (u.peran !== 'Admin' && T.roles.indexOf(u.peran) < 0) throw new Error('Tahap ini menjadi tanggung jawab ' + T.roles.join(' / ') + '.');
      const regs = [].concat(d.no_regs || d.no_reg || []);
      if (!regs.length) throw new Error('Pilih minimal satu peserta.');
      const v = d.nilai || {};
      T.validate && T.validate(v);
      return withLock_(() => {
        const patch = {};
        T.fields.forEach(k => { if (v[k] !== undefined) patch[k] = String(v[k]); });
        if (T.auto) Object.assign(patch, T.auto(v));
        patch.diperbarui = now_();
        if (T.guard) {
          const all = rows_('Pendaftaran');
          regs.forEach(no => { const r = all.find(x => x.no_reg === no); if (!r) throw new Error('Data ' + no + ' tidak ditemukan.'); T.guard(r, v, no); });
        }
        regs.forEach(no => {
          update_('Pendaftaran', no, patch);
          log_(u, T.langkah, T.aksi(v), no, T.detail ? T.detail(v) : '');
          if (T.email) {
            const r = rows_('Pendaftaran').find(x => x.no_reg === no);
            const msg = r && T.email(Object.assign({}, r, patch));
            if (msg) notify_(r.email, msg.subjek + ' — ' + no, emailHtml_(r, msg.isi));
          }
        });
        invalidate_();
        return { diperbarui: regs.length };
      });
    }
  },

  /** Baca sheet (master, keluhan, layanan, survei, log). */
  listSheet: {
    fn: (d) => {
      if (READABLE_SHEETS.indexOf(d.sheet) < 0) throw new Error('Sheet tidak diizinkan.');
      let r = rows_(d.sheet).map(strip_);
      if (d.sheet === 'Log') r = r.slice(-1000).reverse();
      return r;
    }
  },

  /** Tambah / ubah baris data master. */
  saveRow: {
    roles: ['Sekretariat LSP'],
    fn: (d, u) => {
      if (MASTER_SHEETS.indexOf(d.sheet) < 0) throw new Error('Sheet tidak diizinkan.');
      const key = KEY[d.sheet];
      const row = {};
      SHEETS[d.sheet].forEach(h => { if (d.row[h] !== undefined) row[h] = String(d.row[h]); });
      return withLock_(() => {
        let id = row[key];
        const ada = id && rows_(d.sheet).some(r => String(r[key]) === String(id));
        if (ada && !d.isNew) {
          update_(d.sheet, id, row);
        } else {
          if (ada) throw new Error('ID ' + id + ' sudah dipakai.');
          if (!id) { id = masterId_(d.sheet); row[key] = id; }
          append_(d.sheet, row);
        }
        log_(u, 1, (ada ? 'Ubah' : 'Tambah') + ' data ' + d.sheet, id, '');
        invalidate_();
        return { id: id };
      });
    }
  },

  deleteRow: {
    roles: [],
    fn: (d, u) => {
      if (MASTER_SHEETS.indexOf(d.sheet) < 0) throw new Error('Sheet tidak diizinkan.');
      return withLock_(() => {
        const s = sh_(d.sheet);
        const r = rows_(d.sheet).find(x => String(x[KEY[d.sheet]]) === String(d.id));
        if (!r) throw new Error('Data tidak ditemukan.');
        s.deleteRow(r._row);
        log_(u, 10, 'Hapus data ' + d.sheet, d.id, '');
        invalidate_();
        return true;
      });
    }
  },

  /** Tindak lanjut keluhan (langkah 9) & layanan pasca-sertifikasi. */
  updateTiket: {
    fn: (d, u) => {
      const isKel = d.sheet === 'Keluhan';
      if (!isKel && d.sheet !== 'Layanan') throw new Error('Sheet tidak valid.');
      if (ST.TIKET.indexOf(d.status) < 0) throw new Error('Status tidak valid.');
      if (isKel && u.peran !== 'Admin' && u.peran !== 'Bagian Manajemen Mutu') throw new Error('Penanganan keluhan menjadi tanggung jawab Bagian Manajemen Mutu.');
      return withLock_(() => {
        const patch = { status: d.status, petugas: u.nama };
        patch[isKel ? 'tindak_lanjut' : 'catatan_petugas'] = d.catatan || '';
        if (d.status === 'Selesai' || d.status === 'Ditolak') patch.tgl_selesai = now_();
        update_(d.sheet, d.id, patch);
        log_(u, isKel ? 9 : 7, (isKel ? 'Tindak lanjut keluhan: ' : 'Proses layanan: ') + d.status, d.id, d.catatan || '');
        return true;
      });
    }
  },

  /** Manajemen pengguna (hanya Admin). */
  listUsers: { roles: [], fn: () => rows_('Pengguna').map(r => ({ username: r.username, nama: r.nama, peran: r.peran, aktif: r.aktif })) },

  saveUser: {
    roles: [],
    fn: (d, u) => {
      const un = String(d.username || '').trim().toLowerCase();
      if (!/^[a-z0-9._]{3,30}$/.test(un)) throw new Error('Username 3–30 karakter: huruf kecil, angka, titik, garis bawah.');
      if (PERAN.indexOf(d.peran) < 0) throw new Error('Peran tidak valid.');
      return withLock_(() => {
        const ada = rows_('Pengguna').find(r => r.username === un);
        const patch = { nama: d.nama || un, peran: d.peran, aktif: d.aktif || 'YA' };
        if (d.password) {
          if (String(d.password).length < 8) throw new Error('Password minimal 8 karakter.');
          patch.salt = Utilities.getUuid();
          patch.password_hash = hash_(d.password, patch.salt);
        }
        if (ada) update_('Pengguna', un, patch);
        else {
          if (!d.password) throw new Error('Password wajib untuk pengguna baru.');
          append_('Pengguna', Object.assign({ username: un }, patch));
        }
        log_(u, 10, (ada ? 'Ubah' : 'Tambah') + ' pengguna', un, d.peran);
        return true;
      });
    }
  },

  changePassword: {
    fn: (d, u) => {
      const me = rows_('Pengguna').find(r => r.username === u.username);
      if (!me || hash_(d.lama || '', me.salt) !== me.password_hash) throw new Error('Password lama salah.');
      if (String(d.baru || '').length < 8) throw new Error('Password baru minimal 8 karakter.');
      const salt = Utilities.getUuid();
      update_('Pengguna', u.username, { salt: salt, password_hash: hash_(d.baru, salt) });
      log_(u, 10, 'Ganti password', u.username, '');
      return true;
    }
  }
};

/** Definisi tahapan SOP yang diubah admin. */
const TAHAP = {
  kelengkapan: {
    langkah: 2, roles: ['Bagian Administrasi'],
    fields: ['status_kelengkapan', 'catatan_kelengkapan', 'cek_berkas'],
    validate: v => {
      if (ST.LENGKAP.indexOf(v.status_kelengkapan) < 0) throw new Error('Status kelengkapan tidak valid.');
      if (v.status_kelengkapan === 'Belum Lengkap' && !String(v.catatan_kelengkapan || '').trim()) throw new Error('Tuliskan berkas apa yang belum lengkap pada catatan.');
    },
    auto: () => ({ tgl_kelengkapan: now_() }),
    email: r => r.status_kelengkapan === 'Lengkap' ? {
      subjek: 'Berkas lengkap — jadwalkan verifikasi langsung',
      isi: 'Berkas pendaftaran Anda telah diperiksa dan dinyatakan <b>LENGKAP</b>.<br>Langkah berikutnya: <b>verifikasi langsung</b>. Datang membawa seluruh <b>berkas asli</b> (surat keterangan aktif, print out KHS, KTP, APL-01 bertanda tangan, dan bukti persyaratan lainnya).<br>' +
        esc_(settings_().info_verifikasi_langsung || 'Tempat dan waktu: Sekretariat LSP UNIMED pada jam layanan.')
    } : r.status_kelengkapan === 'Belum Lengkap' ? {
      subjek: 'Berkas belum lengkap',
      isi: 'Berkas pendaftaran Anda <b>belum lengkap</b>.<br>Catatan admin: ' + esc_(r.catatan_kelengkapan || '-') + '<br>Silakan unggah ulang berkas melalui menu Status permohonan di SIPINTAR menggunakan No. Registrasi dan email ini.'
    } : null,
    aksi: v => 'Pemeriksaan kelengkapan berkas: ' + v.status_kelengkapan,
    detail: v => [v.cek_berkas ? 'Diperiksa: ' + v.cek_berkas : '', v.catatan_kelengkapan || ''].filter(String).join(' · ')
  },
  verifikasi: {
    langkah: 3, roles: ['Bagian Sertifikasi'],
    fields: ['status_verifikasi', 'catatan_verifikasi', 'verifikasi_langsung', 'cek_persyaratan'],
    validate: v => {
      if (ST.VERIF.indexOf(v.status_verifikasi) < 0) throw new Error('Status verifikasi tidak valid.');
      if (v.status_verifikasi === 'Memenuhi Syarat' && String(v.verifikasi_langsung) !== 'YA') throw new Error('Memenuhi Syarat hanya bisa disimpan setelah berkas asli dicocokkan (verifikasi langsung).');
    },
    guard: (r, v, no) => { if (v.status_verifikasi !== 'Menunggu Verifikasi' && r.status_kelengkapan !== 'Lengkap') throw new Error(no + ': berkas belum dinyatakan lengkap oleh Bagian Administrasi (L2).'); },
    auto: v => ({ tgl_verifikasi: now_(), rekomendasi_apl01: v.status_verifikasi === 'Memenuhi Syarat' ? 'Diterima' : v.status_verifikasi === 'Tidak Memenuhi Syarat' ? 'Tidak diterima' : '' }),
    email: r => (r.status_verifikasi === 'Menunggu Verifikasi' || r.status_verifikasi === 'Perlu Perbaikan' && !r.catatan_verifikasi) ? null : {
      subjek: 'Hasil verifikasi persyaratan: ' + r.status_verifikasi,
      isi: 'Hasil verifikasi persyaratan Anda: <b>' + esc_(r.status_verifikasi) + '</b>.' + (r.catatan_verifikasi ? '<br>Catatan admin: ' + esc_(r.catatan_verifikasi) : '') +
        (r.status_verifikasi === 'Memenuhi Syarat' ? '<br>Jadwal, asesor, dan TUK akan disampaikan melalui email berikutnya.' : '')
    },
    aksi: v => (String(v.verifikasi_langsung) === 'YA' ? 'Verifikasi langsung berkas asli: ' : 'Verifikasi persyaratan: ') + v.status_verifikasi,
    detail: v => v.catatan_verifikasi || ''
  },
  plotting: {
    langkah: 4, roles: ['Bagian Sertifikasi'],
    guard: (r, v, no) => { if (r.status_verifikasi !== 'Memenuhi Syarat') throw new Error(no + ': belum lolos verifikasi langsung (L3).'); },
    fields: ['id_asesor', 'id_tuk', 'tanggal_asesmen', 'waktu_asesmen'],
    validate: v => { if (!v.id_asesor || !v.id_tuk || !v.tanggal_asesmen) throw new Error('Asesor, TUK, dan tanggal wajib diisi.'); },
    auto: () => ({ status_jadwal: 'Terjadwal' }),
    email: r => ({
      subjek: 'Jadwal asesmen kompetensi',
      isi: 'Jadwal asesmen Anda telah ditetapkan:<br>Tanggal: <b>' + esc_(r.tanggal_asesmen) + ' ' + esc_(r.waktu_asesmen || '') + '</b><br>TUK: ' +
        esc_(namaDari_('TUK', 'id_tuk', r.id_tuk, 'nama_tuk')) + '<br>Asesor: ' + esc_(namaDari_('Asesor', 'id_asesor', r.id_asesor, 'nama_asesor')) +
        '<br>Hadir 30 menit sebelum asesmen dengan membawa KTP asli dan bukti pendaftaran.'
    }),
    aksi: () => 'Penjadwalan: asesor & TUK ditetapkan, jadwal disampaikan',
    detail: v => v.id_asesor + ' · ' + v.id_tuk + ' · ' + v.tanggal_asesmen + ' ' + (v.waktu_asesmen || '')
  },
  asesmen: {
    langkah: 5, roles: ['Sekretariat LSP', 'Bagian Sertifikasi'],
    fields: ['status_asesmen', 'catatan_asesmen'],
    validate: v => { if (ST.ASESMEN.indexOf(v.status_asesmen) < 0) throw new Error('Status asesmen tidak valid.'); },
    aksi: v => (v.status_asesmen === 'Dokumen Siap' ? 'Administrasi asesmen: dokumen disiapkan' :
      v.status_asesmen === 'Hadir' || v.status_asesmen === 'Selesai' ? 'Pelaksanaan asesmen: ' + v.status_asesmen :
        'Status asesmen: ' + v.status_asesmen),
    detail: v => v.catatan_asesmen || ''
  },
  hasil: {
    langkah: 7, roles: ['Bagian Sertifikasi'],
    fields: ['rekomendasi', 'link_surat_hasil', 'catatan_hasil'],
    validate: v => { if (['Kompeten', 'Belum Kompeten'].indexOf(v.rekomendasi) < 0) throw new Error('Pilih Kompeten / Belum Kompeten.'); },
    auto: v => ({ tgl_hasil: now_(), status_asesmen: 'Selesai', status_sertifikat: v.rekomendasi === 'Kompeten' ? 'Diajukan ke BNSP' : 'Belum Terbit' }),
    email: r => ({
      subjek: 'Pemberitahuan hasil sertifikasi',
      isi: 'Keputusan sertifikasi Anda: <b>' + esc_(r.rekomendasi.toUpperCase()) + '</b>.' + (r.link_surat_hasil ? '<br>Surat pemberitahuan hasil: <a href="' + esc_(r.link_surat_hasil) + '">unduh di sini</a>.' : '') +
        '<br>Apabila tidak sepakat dengan keputusan ini, Anda berhak mengajukan banding melalui menu Banding Asesmen di SIPINTAR.'
    }),
    aksi: v => 'Hasil sertifikasi disampaikan: ' + v.rekomendasi,
    detail: v => v.catatan_hasil || ''
  },
  sertifikat: {
    langkah: 8, roles: ['Bagian Administrasi'],
    fields: ['status_sertifikat', 'no_sertifikat', 'penerima'],
    validate: v => { if (ST.SERT.indexOf(v.status_sertifikat) < 0) throw new Error('Status sertifikat tidak valid.'); },
    auto: v => (v.status_sertifikat === 'Sudah Diserahkan' ? { tgl_serah: now_() } : {}),
    email: r => r.status_sertifikat !== 'Siap Diambil' ? null : {
      subjek: 'Sertifikat kompetensi siap diambil',
      isi: 'Sertifikat kompetensi Anda' + (r.no_sertifikat ? ' (No. ' + esc_(r.no_sertifikat) + ')' : '') + ' sudah dapat diambil. ' + esc_(settings_().info_pengambilan_sertifikat || '')
    },
    aksi: v => 'Sertifikat: ' + v.status_sertifikat,
    detail: v => [v.no_sertifikat, v.penerima ? 'diterima oleh ' + v.penerima : ''].filter(String).join(' · ')
  },
  pelaksanaan: {
    langkah: 6, roles: ['Bagian Sertifikasi'],
    fields: ['status_asesmen', 'catatan_asesmen'],
    validate: v => { if (ST.ASESMEN.indexOf(v.status_asesmen) < 0) throw new Error('Status asesmen tidak valid.'); },
    aksi: v => 'Pelaksanaan pelayanan sertifikasi: ' + v.status_asesmen,
    detail: v => v.catatan_asesmen || ''
  },
  data: {
    langkah: 2, roles: ['Bagian Administrasi', 'Sekretariat LSP'],
    fields: ['nama', 'nim', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'email', 'hp', 'alamat', 'instansi', 'pendidikan', 'pekerjaan', 'id_jadwal'],
    aksi: () => 'Koreksi data pemohon',
    detail: v => Object.keys(v).join(', ')
  }
};

/* ============================ SETUP & PEMELIHARAAN ============================ */

/** Jalankan SEKALI dari editor Apps Script. Aman diulang: sheet yang ada tidak ditimpa. */
function setup() {
  const ss = ss_();
  Object.keys(SHEETS).forEach(name => {
    let s = ss.getSheetByName(name);
    if (!s) s = ss.insertSheet(name);
    const head = SHEETS[name];
    if (s.getLastRow() === 0) {
      s.getRange(1, 1, Math.max(s.getMaxRows(), 500), head.length).setNumberFormat('@');
      s.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#0b2a5b').setFontColor('#ffffff');
      s.setFrozenRows(1);
    } else {
      // tambahkan kolom baru jika versi skrip lebih baru
      const cur = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
      head.forEach(h => {
        if (cur.indexOf(h) < 0) {
          const c = s.getLastColumn() + 1;
          s.getRange(1, c).setValue(h).setFontWeight('bold').setBackground('#0b2a5b').setFontColor('#ffffff');
          s.getRange(2, c, Math.max(s.getMaxRows() - 1, 1), 1).setNumberFormat('@');
        }
      });
    }
  });
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembar1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);

  seed_();
  ensureSettings_();

  let pesan = 'Setup selesai.';
  if (!rows_('Pengguna').length) {
    const pw = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    const salt = Utilities.getUuid();
    append_('Pengguna', { username: 'admin', nama: 'Administrator LSP', peran: 'Admin', salt: salt, password_hash: hash_(pw, salt), aktif: 'YA' });
    pesan += '\nAkun admin awal → username: admin | password: ' + pw + '\nSegera ganti password setelah login.';
  }
  Logger.log(pesan);
  try { SpreadsheetApp.getUi().alert(pesan); } catch (e) { /* dijalankan dari editor tanpa UI */ }
  invalidate_();
}

/**
 * PEMANAS — jalankan pasangPemanas() SEKALI dari editor.
 * Membuat pemicu tiap 5 menit yang menyegarkan cache data publik,
 * sehingga halaman situs tidak menunggu spreadsheet dibaca ulang.
 */
function pemanas() {
  CacheService.getScriptCache().remove('publicData');
  PUBLIC.publicData();
}

function pasangPemanas() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'pemanas').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('pemanas').timeBased().everyMinutes(5).create();
  pemanas();
  Logger.log('Pemanas aktif: cache data publik disegarkan setiap 5 menit.');
}

/** Darurat: reset password akun "admin". Password baru tampil di Log Eksekusi. */
function resetPasswordAdmin() {
  const pw = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  const salt = Utilities.getUuid();
  const ada = rows_('Pengguna').find(r => r.username === 'admin');
  if (ada) update_('Pengguna', 'admin', { salt: salt, password_hash: hash_(pw, salt), aktif: 'YA', peran: 'Admin' });
  else append_('Pengguna', { username: 'admin', nama: 'Administrator LSP', peran: 'Admin', salt: salt, password_hash: hash_(pw, salt), aktif: 'YA' });
  Logger.log('Password baru admin: ' + pw);
}

/**
 * RAPIKAN BARIS — jalankan SEKALI dari editor bila data di sheet tidak dimulai dari baris 2
 * (mis. Excel awal menaruh data mulai baris 1002). Menghapus baris kosong di antara judul dan data
 * pada semua sheet SIPINTAR. Isi data tidak diubah.
 */
function rapikanBaris() {
  const ss = ss_(), laporan = [];
  Object.keys(SHEETS).forEach(name => {
    const s = ss.getSheetByName(name);
    if (!s || s.getLastRow() < 2) return;
    const last = s.getLastRow(), cols = Math.max(s.getLastColumn(), 1);
    const v = s.getRange(2, 1, last - 1, cols).getValues();
    // kumpulkan blok baris kosong, hapus dari bawah agar nomor baris tidak bergeser
    const blok = []; let mulai = -1;
    v.forEach((r, i) => {
      const kosong = r.join('') === '';
      if (kosong && mulai < 0) mulai = i;
      if (!kosong && mulai >= 0) { blok.push([mulai + 2, i - mulai]); mulai = -1; }
    });
    let n = 0;
    blok.reverse().forEach(b => { s.deleteRows(b[0], b[1]); n += b[1]; });
    // sisakan cadangan 500 baris berformat teks di bawah data
    const sisa = s.getMaxRows() - s.getLastRow();
    if (sisa < 500) s.insertRowsAfter(s.getMaxRows(), 500 - sisa);
    s.getRange(s.getLastRow() + 1, 1, 500, cols).setNumberFormat('@');
    if (n) laporan.push(name + ': ' + n + ' baris kosong dihapus');
  });
  invalidate_();
  const pesan = laporan.length ? 'Rapikan selesai.\n' + laporan.join('\n') : 'Semua sheet sudah rapi.';
  Logger.log(pesan);
  try { SpreadsheetApp.getUi().alert(pesan); } catch (e) { /* dari editor */ }
}

/** Tambahkan kunci Pengaturan baru pada spreadsheet lama tanpa mengubah isian yang ada. */
function ensureSettings_() {
  const ada = settings_();
  [['info_verifikasi_langsung', 'Verifikasi langsung berkas asli di Sekretariat LSP UNIMED, Senin–Jumat pukul 08.00–15.00 WIB, paling lambat 15 Oktober 2026.', 'Tempat & waktu verifikasi langsung (tampil ke asesi dan di email)'],
   ['link_contoh_apl01', '', 'Link contoh pengisian FR.APL.01 (Google Drive, akses: siapa saja yang memiliki link)'],
   ['link_contoh_apl02', '', 'Link contoh pengisian FR.APL.02 (Google Drive, akses: siapa saja yang memiliki link)']]
    .forEach(r => { if (!(r[0] in ada)) append_('Pengaturan', { kunci: r[0], nilai: r[1], keterangan: r[2] }); });
}

/** Data awal (contoh) — hanya diisi bila sheet masih kosong. */
function seed_() {
  if (!rows_('Pengaturan').length) {
    [
      ['nama_lsp', 'LSP Universitas Negeri Medan', 'Nama resmi LSP'],
      ['nama_singkat', 'LSP UNIMED', ''],
      ['tagline', 'Sistem Informasi Pemantauan dan Layanan Terintegrasi LSP Universitas Negeri Medan', ''],
      ['deskripsi', 'SIPINTAR LSP UNIMED adalah pusat layanan digital sertifikasi kompetensi: informasi skema, pendaftaran, verifikasi, penjadwalan, hasil uji, hingga pelacakan sertifikat — profesional, objektif, transparan, terdokumentasi, dan mampu telusur.', ''],
      ['nomor_lisensi', '', 'Nomor lisensi BNSP'],
      ['alamat', 'Jl. William Iskandar Ps. V, Medan Estate, Deli Serdang, Sumatera Utara 20221', ''],
      ['email', 'lspunimed@unimed.ac.id', 'Email resmi LSP'],
      ['telepon', '', ''],
      ['whatsapp', '', 'Format 62812xxxx'],
      ['jam_layanan', 'Senin–Jumat, 08.00–16.00 WIB', ''],
      ['pengumuman', 'Seluruh informasi resmi sertifikasi, pengumuman, dan jadwal final disampaikan melalui email yang Anda daftarkan. Pastikan email aktif.', ''],
      ['link_template_apl02', '', 'Link unduhan template APL-02 (Google Drive)'],
      ['link_contoh_apl01', '', 'Link contoh pengisian FR.APL.01 (Google Drive, akses: siapa saja yang memiliki link)'],
      ['link_contoh_apl02', '', 'Link contoh pengisian FR.APL.02 (Google Drive, akses: siapa saja yang memiliki link)'],
      ['info_verifikasi_langsung', 'Verifikasi langsung berkas asli di Sekretariat LSP UNIMED, Senin–Jumat pukul 08.00–15.00 WIB, paling lambat 15 Oktober 2026.', 'Tempat & waktu verifikasi langsung (tampil ke asesi dan di email)'],
      ['kirim_email', 'YA', 'YA = kirim email otomatis ke peserta (bukti daftar, verifikasi, jadwal, hasil, sertifikat)'],
      ['info_pengambilan_sertifikat', 'Sertifikat diambil di Sekretariat LSP pada jam layanan dengan membawa KTP asli. Pengambilan oleh orang lain wajib membawa surat kuasa.', '']
    ].forEach(r => append_('Pengaturan', { kunci: r[0], nilai: r[1], keterangan: r[2] }));
  }
  if (!rows_('Dokumen').length) {
    [
      ['XVII/SOP-PKS', 'SOP Pelayanan Kegiatan Sertifikasi', 'SOP'],
      ['PBNSP 201', 'Persyaratan Umum Lembaga Sertifikasi Profesi', 'Acuan'],
      ['PBNSP 202', 'Pelaksanaan Sertifikasi Kompetensi', 'Acuan'],
      ['PBNSP 206', 'Sistem Manajemen Mutu LSP', 'Acuan'],
      ['ISO/IEC 17024:2012', 'Conformity Assessment – General Requirements for Bodies Operating Certification of Persons', 'Acuan'],
      ['FR.APL.01', 'Formulir Permohonan Sertifikasi Kompetensi', 'Formulir'],
      ['FR.APL.02', 'Formulir Asesmen Mandiri', 'Formulir']
    ].forEach((r, i) => append_('Dokumen', { id_dok: 'DOK-' + pad_(i + 1, 3), nomor: r[0], judul: r[1], kategori: r[2], id_skema: '', link: '', status: 'Aktif' }));
  }
  if (!rows_('Skema').length) {
    append_('Skema', { id_skema: 'SKM-001', kode_skema: 'CONTOH-001', nama_skema: '(Contoh) Skema Sertifikasi — ganti dengan skema resmi', jenis_skema: 'Okupasi', jumlah_unit: '8', persyaratan: 'Mahasiswa aktif / alumni\nTelah lulus mata kuliah terkait\nMengisi APL-01 dan APL-02', biaya: '0', link_dokumen: '', status: 'Aktif' });
  }
  if (!rows_('TUK').length) {
    append_('TUK', { id_tuk: 'TUK-001', nama_tuk: '(Contoh) TUK Sewaktu Fakultas Teknik', jenis_tuk: 'Sewaktu', alamat: 'Gedung Fakultas Teknik, Unimed', penanggung_jawab: '', kontak: '', status: 'Aktif' });
  }
}

/* ================================ UTILITAS ================================ */

function ss_() { return CONFIG.SPREADSHEET_ID ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }

function sh_(name) {
  const s = ss_().getSheetByName(name);
  if (!s) throw new Error('Sheet "' + name + '" belum ada. Jalankan setup() di Apps Script.');
  return s;
}

function rows_(name) {
  const s = sh_(name);
  const last = s.getLastRow();
  if (last < 2) return [];
  const v = s.getRange(1, 1, last, s.getLastColumn()).getValues();
  const head = v.shift().map(String);
  const out = [];
  v.forEach((r, i) => {
    if (r.join('') === '') return;
    const o = { _row: i + 2 };
    head.forEach((h, j) => o[h] = val_(r[j]));
    out.push(o);
  });
  return out;
}

function val_(v) {
  if (v instanceof Date) {
    const hasTime = v.getHours() || v.getMinutes();
    return Utilities.formatDate(v, CONFIG.TZ, hasTime ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd');
  }
  return v === null || v === undefined ? '' : String(v);
}

function clean_(v) {
  v = v === null || v === undefined ? '' : String(v);
  return /^[=@]/.test(v) ? "'" + v : v; // cegah formula injection
}

function append_(name, obj) {
  const s = sh_(name);
  const head = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].map(String);
  const row = head.map(h => clean_(obj[h]));
  const r = s.getLastRow() + 1;
  s.getRange(r, 1, 1, head.length).setNumberFormat('@').setValues([row]);
}

function update_(name, key, patch) {
  const s = sh_(name);
  const head = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].map(String);
  const kcol = head.indexOf(KEY[name]);
  const keys = s.getRange(2, kcol + 1, Math.max(s.getLastRow() - 1, 1), 1).getValues().map(r => String(r[0]));
  const idx = keys.indexOf(String(key));
  if (idx < 0) throw new Error('Data ' + key + ' tidak ditemukan di ' + name + '.');
  const rowNum = idx + 2;
  const cur = s.getRange(rowNum, 1, 1, head.length).getValues()[0];
  head.forEach((h, j) => { if (h !== KEY[name] && patch[h] !== undefined) cur[j] = clean_(patch[h]); });
  s.getRange(rowNum, 1, 1, head.length).setNumberFormat('@').setValues([cur]);
}

function strip_(o) { const c = Object.assign({}, o); delete c._row; return c; }

function index_(arr, k) { const m = {}; arr.forEach(r => m[r[k]] = r); return m; }

function settings_() { const m = {}; rows_('Pengaturan').forEach(r => m[r.kunci] = r.nilai); return m; }

function now_() { return Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss'); }

function today_() { return Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd'); }

function pad_(n, w) { return String(n).padStart(w, '0'); }

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Server sedang sibuk, silakan coba lagi.');
  try { return fn(); } finally { lock.releaseLock(); }
}

/** ID master berikutnya, mis. SKM-004 (berdasarkan nomor terbesar yang ada). */
function masterId_(sheet) {
  const pre = ID_PREFIX[sheet] + '-';
  let max = 0;
  rows_(sheet).forEach(r => {
    const k = String(r[KEY[sheet]]);
    if (k.indexOf(pre) === 0) max = Math.max(max, Number(k.slice(pre.length)) || 0);
  });
  return pre + pad_(max + 1, 3);
}

/** Nomor urut per awalan per bulan (disimpan di Script Properties). Panggil di dalam lock. */
function nextId_(counter, prefix, width) {
  const props = PropertiesService.getScriptProperties();
  const k = 'seq_' + counter + '_' + prefix;
  const n = Number(props.getProperty(k) || 0) + 1;
  props.setProperty(k, String(n));
  return prefix + pad_(n, width);
}

function hash_(pw, salt) {
  let h = String(salt) + String(pw);
  for (let i = 0; i < 300; i++) {
    h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8)
      .map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
  }
  return h;
}

function auth_(token) {
  if (!token) throw new Error('Sesi berakhir. Silakan login kembali.');
  const s = CacheService.getScriptCache().get('sess_' + token);
  if (!s) throw new Error('Sesi berakhir. Silakan login kembali.');
  return JSON.parse(s);
}

function log_(user, langkah, aksi, ref, detail) {
  try {
    append_('Log', { waktu: now_(), aktor: user.nama || user.username, peran: user.peran, langkah_sop: String(langkah), aksi: aksi, ref: ref, detail: detail || '' });
  } catch (e) { /* log tidak boleh menggagalkan transaksi */ }
}

function invalidate_() { CacheService.getScriptCache().remove('publicData'); }

function mask_(nama) {
  return String(nama || '').split(/\s+/).filter(String).map(w => w.length <= 2 ? w : w.slice(0, 2) + '*'.repeat(Math.min(w.length - 2, 5))).join(' ');
}

function jadwalBuka_(j, terisi) {
  if (j.status !== 'Dibuka') return false;
  if (j.batas_daftar && String(j.batas_daftar) < today_()) return false;
  const kuota = Number(j.kuota) || 0;
  return kuota === 0 || terisi < kuota;
}

function jadwalLabel_(j, mapS) {
  if (!j) return '';
  return ((mapS[j.id_skema] || {}).nama_skema || j.id_skema) + ' — ' + j.tanggal;
}

function cariPeserta_(noReg, email) {
  const no = String(noReg || '').trim().toUpperCase();
  const em = String(email || '').trim().toLowerCase();
  if (!no || !em) throw new Error('Isi No. Registrasi dan email yang didaftarkan.');
  const r = rows_('Pendaftaran').find(x => String(x.no_reg).toUpperCase() === no);
  if (!r || String(r.email).toLowerCase() !== em) throw new Error('Data tidak ditemukan. Periksa kembali No. Registrasi dan email.');
  return r;
}

/** Tampilan aman untuk peserta (tanpa NIK lengkap / tautan berkas internal). */
function publicView_(r) {
  const mapS = index_(rows_('Skema'), 'id_skema');
  const mapT = index_(rows_('TUK'), 'id_tuk');
  const mapA = index_(rows_('Asesor'), 'id_asesor');
  const mapJ = index_(rows_('Jadwal'), 'id_jadwal');
  const j = mapJ[r.id_jadwal] || {};
  const logs = rows_('Log').filter(l => l.ref === r.no_reg).map(l => ({ waktu: l.waktu, langkah_sop: l.langkah_sop, aksi: l.aksi }));
  return {
    no_reg: r.no_reg, nama: r.nama, nik: String(r.nik).slice(0, 4) + '********' + String(r.nik).slice(-4),
    email: r.email, waktu_daftar: r.waktu_daftar,
    skema: (mapS[r.id_skema] || {}).nama_skema || r.id_skema,
    kode_skema: (mapS[r.id_skema] || {}).kode_skema || '',
    jadwal_tanggal: j.tanggal || '', jadwal_waktu: j.waktu || '',
    status_kelengkapan: r.status_kelengkapan || 'Menunggu Pemeriksaan', catatan_kelengkapan: r.catatan_kelengkapan, tgl_kelengkapan: r.tgl_kelengkapan,
    verifikasi_langsung: r.verifikasi_langsung, rekomendasi_apl01: r.rekomendasi_apl01,
    berkas: ['file_apl01', 'file_ktp', 'file_foto', 'file_ijazah', 'file_apl02', 'file_pendukung'].filter(k => r[k]).map(k => k.replace('file_', '')),
    status_verifikasi: r.status_verifikasi, catatan_verifikasi: r.catatan_verifikasi, tgl_verifikasi: r.tgl_verifikasi,
    status_jadwal: r.status_jadwal,
    asesor: (mapA[r.id_asesor] || {}).nama_asesor || '',
    tuk: (mapT[r.id_tuk] || {}).nama_tuk || '',
    tuk_alamat: (mapT[r.id_tuk] || {}).alamat || '',
    tanggal_asesmen: r.tanggal_asesmen, waktu_asesmen: r.waktu_asesmen,
    status_asesmen: r.status_asesmen,
    rekomendasi: r.rekomendasi, tgl_hasil: r.tgl_hasil, link_surat_hasil: r.link_surat_hasil, catatan_hasil: r.catatan_hasil,
    status_sertifikat: r.status_sertifikat, no_sertifikat: r.no_sertifikat, tgl_serah: r.tgl_serah,
    riwayat: logs
  };
}

/** Simpan berkas base64 ke Drive: SIPINTAR_UPLOADS/<no_reg>/<jenis>.<ext> */
function saveFile_(f, folderName, label) {
  if (!f || !f.data) return '';
  const ok = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
  if (!ok[f.type]) throw new Error('Berkas ' + label + ' harus PDF, JPG, atau PNG.');
  const bytes = Utilities.base64Decode(String(f.data).replace(/^data:[^,]+,/, ''));
  if (bytes.length > CONFIG.MAX_FILE_MB * 1024 * 1024) throw new Error('Berkas ' + label + ' melebihi ' + CONFIG.MAX_FILE_MB + ' MB.');
  const root = uploadRoot_();
  const it = root.getFoldersByName(folderName);
  const folder = it.hasNext() ? it.next() : root.createFolder(folderName);
  const blob = Utilities.newBlob(bytes, f.type, folderName + '_' + label + '.' + ok[f.type]);
  return folder.createFile(blob).getUrl();
}

function uploadRoot_() {
  if (CONFIG.UPLOAD_FOLDER_ID) return DriveApp.getFolderById(CONFIG.UPLOAD_FOLDER_ID);
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('upload_root');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* folder terhapus → buat ulang */ } }
  const f = DriveApp.createFolder('SIPINTAR_UPLOADS');
  props.setProperty('upload_root', f.getId());
  return f;
}

/* ============================ EMAIL ============================ */

function esc_(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function namaDari_(sheet, key, id, field) { const r = rows_(sheet).find(x => x[key] === id); return r ? r[field] : (id || '-'); }

/** Kirim email bila Pengaturan kirim_email = YA. Kegagalan email tidak menggagalkan transaksi. */
function notify_(to, subject, html) {
  try {
    if (String(settings_().kirim_email || 'YA').toUpperCase() !== 'YA' || !to) return false;
    if (MailApp.getRemainingDailyQuota() < 1) return false;
    const set = settings_();
    MailApp.sendEmail({ to: to, subject: '[' + (set.nama_singkat || 'LSP UNIMED') + '] ' + subject, htmlBody: html, name: set.nama_lsp || 'LSP UNIMED', replyTo: set.email || undefined });
    return true;
  } catch (e) { return false; }
}

function emailHtml_(r, isi) {
  const set = settings_();
  return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#000;max-width:560px">' +
    '<p>Yth. ' + esc_(r.nama) + ',</p><p>' + isi + '</p>' +
    '<p>No. Registrasi: <b>' + esc_(r.no_reg) + '</b><br>Pantau status Anda di SIPINTAR menggunakan No. Registrasi dan email ini.</p>' +
    '<p>Hormat kami,<br>' + esc_(set.nama_lsp || 'LSP Universitas Negeri Medan') + '</p></div>';
}

function buktiHtml_(b) {
  const set = settings_();
  const row = (k, v) => '<tr><td style="padding:4px 12px 4px 0;color:#000">' + k + '</td><td style="padding:4px 0;color:#000"><b>' + esc_(v) + '</b></td></tr>';
  return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#000;max-width:560px">' +
    '<p>Yth. ' + esc_(b.nama) + ',</p><p>Permohonan sertifikasi kompetensi Anda telah kami terima. Simpan email ini sebagai <b>bukti pendaftaran</b>.</p>' +
    '<table style="border-collapse:collapse">' + row('No. Registrasi', b.no_reg) + row('Nama', b.nama) + row('NIK', b.nik) + row('Skema', b.skema) +
    row('Jadwal uji', b.tanggal + ' ' + (b.waktu || '')) + row('TUK', b.tuk) + row('Waktu daftar', b.waktu_daftar) + row('Status', b.status_verifikasi) + '</table>' +
    '<p>Langkah berikutnya: (1) Bagian Administrasi memeriksa kelengkapan berkas yang Anda unggah; (2) bila lengkap, Anda diminta datang untuk <b>verifikasi langsung</b> dengan membawa seluruh <b>berkas asli</b>. ' + esc_(set.info_verifikasi_langsung || '') + '</p>' +
    '<p>Selanjutnya: Hasil verifikasi, jadwal final, asesor, dan TUK akan dikirim ke email ini dan dapat dipantau di SIPINTAR menu Status Permohonan.</p>' +
    '<p>Hormat kami,<br>' + esc_(set.nama_lsp || 'LSP Universitas Negeri Medan') + '</p></div>';
}
