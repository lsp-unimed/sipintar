/* MODE DEMO — tiruan backend di browser. Aktif hanya jika API_URL di config.js kosong.
   Data contoh disimpan di localStorage browser ini saja. Akun demo: admin / demo12345 */
(function () {
  const KEY = 'sipintar_demo_db_v4';
  const SEED = window.SIPINTAR_SEED || { skema: [], tuk: [] };
  const pad = (n, w) => String(n).padStart(w, '0');
  const now = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2) + ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2); };
  const plus = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2); };
  const today = () => plus(0);
  const ym = () => { const d = new Date(); return String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1, 2); };

  function seed() {
    const db = {
      seq: {},
      Pengaturan: {
        nama_lsp: 'LSP Universitas Negeri Medan', nama_singkat: 'LSP UNIMED',
        tagline: 'Sistem Informasi Pemantauan dan Layanan Terintegrasi LSP Universitas Negeri Medan',
        deskripsi: 'SIPINTAR LSP UNIMED adalah pusat layanan digital sertifikasi kompetensi: informasi skema, pendaftaran, verifikasi, penjadwalan, hasil uji, hingga pelacakan sertifikat — profesional, objektif, transparan, terdokumentasi, dan mampu telusur.',
        nomor_lisensi: '', alamat: 'Jl. William Iskandar Ps. V, Medan Estate, Deli Serdang, Sumatera Utara 20221',
        email: 'lspunimed@unimed.ac.id', telepon: '', whatsapp: '', jam_layanan: 'Senin–Jumat, 08.00–16.00 WIB',
        pengumuman: 'Pelaksanaan Uji Kompetensi perdana untuk 16 skema dilaksanakan pada Sabtu, 17 Oktober 2026. Informasi resmi dikirim ke email yang Anda daftarkan.',
        link_template_apl02: '', info_pengambilan_sertifikat: 'Sertifikat diambil di Sekretariat LSP pada jam layanan dengan membawa KTP asli. Pengambilan oleh orang lain wajib membawa surat kuasa.',
        info_verifikasi_langsung: 'Verifikasi langsung berkas asli di Sekretariat LSP UNIMED, Senin–Jumat pukul 08.00–15.00 WIB, paling lambat 15 Oktober 2026.'
      },
      Skema: SEED.skema.map((k, i) => ({
        id_skema: 'SKM-' + pad(i + 1, 3), kode_skema: '', nama_skema: k.nama, jenis_skema: k.jenis, jumlah_unit: '',
        persyaratan: k.syarat.join('\n'), biaya: '', link_dokumen: '', status: 'Aktif'
      })),
      TUK: SEED.tuk.map(t => ({ id_tuk: t[0], nama_tuk: t[1], jenis_tuk: 'Sewaktu', alamat: 'Universitas Negeri Medan', penanggung_jawab: t[2], kontak: '', status: 'Aktif' })),
      Asesor: SEED.skema.map((k, i) => ({ id_asesor: 'ASR-' + pad(i + 1, 3), nama_asesor: k.asesor[0], no_reg_met: 'MET.' + k.asesor[1], skema: 'SKM-' + pad(i + 1, 3), email: '', hp: '', status: 'Aktif' })),
      Jadwal: SEED.skema.map((k, i) => ({
        id_jadwal: 'JDW-' + pad(i + 1, 3), id_skema: 'SKM-' + pad(i + 1, 3), tanggal: '2026-10-17', waktu: '08.00 WIB – selesai',
        id_tuk: k.tuk, kuota: '0', batas_daftar: '2026-10-14', status: 'Dibuka', keterangan: 'Uji kompetensi perdana (penyaksian BNSP)'
      })),
      Pendaftaran: [],
      Keluhan: [], Layanan: [], Survei: [], Log: [],
      Dokumen: [
        { id_dok: 'DOK-001', nomor: 'XVII/SOP-PKS', judul: 'SOP Pelayanan Kegiatan Sertifikasi', kategori: 'SOP', id_skema: '', link: '', status: 'Aktif' },
        { id_dok: 'DOK-002', nomor: 'PBNSP 201', judul: 'Persyaratan Umum Lembaga Sertifikasi Profesi', kategori: 'Acuan', id_skema: '', link: '', status: 'Aktif' },
        { id_dok: 'DOK-003', nomor: 'PBNSP 202', judul: 'Pelaksanaan Sertifikasi Kompetensi', kategori: 'Acuan', id_skema: '', link: '', status: 'Aktif' },
        { id_dok: 'DOK-004', nomor: 'FR.APL.01', judul: 'Formulir Permohonan Sertifikasi Kompetensi', kategori: 'Formulir', id_skema: '', link: '', status: 'Aktif' }
      ].concat(SEED.skema.map((k, i) => ({ id_dok: 'DOK-' + pad(5 + i, 3), nomor: 'FR.APL.02', judul: 'Asesmen Mandiri (APL-02) — ' + k.nama, kategori: 'Formulir', id_skema: 'SKM-' + pad(i + 1, 3), link: '', status: 'Aktif' }))),
      Pengguna: [{ username: 'admin', nama: 'Administrator (Demo)', peran: 'Admin', password: 'demo12345', aktif: 'YA' }]
    };
    // contoh peserta di berbagai tahap
    const contoh = [
      ['Andi Pratama', 'JDW-001', { status_kelengkapan: 'Lengkap', verifikasi_langsung: 'YA', rekomendasi_apl01: 'Diterima', status_verifikasi: 'Memenuhi Syarat', status_jadwal: 'Terjadwal', id_asesor: 'ASR-001', id_tuk: 'TUK-009', tanggal_asesmen: '2026-10-17', waktu_asesmen: '08.00 WIB', status_asesmen: 'Dokumen Siap' }],
      ['Siti Rahmawati', 'JDW-001', { status_kelengkapan: 'Lengkap', verifikasi_langsung: 'YA', rekomendasi_apl01: 'Diterima', status_verifikasi: 'Memenuhi Syarat', status_jadwal: 'Terjadwal', id_asesor: 'ASR-001', id_tuk: 'TUK-009', tanggal_asesmen: '2026-10-17', waktu_asesmen: '08.00 WIB' }],
      ['Budi Santoso', 'JDW-002', { status_kelengkapan: 'Lengkap', verifikasi_langsung: 'YA', rekomendasi_apl01: 'Diterima', status_verifikasi: 'Memenuhi Syarat' }],
      ['Dewi Lestari', 'JDW-003', { status_kelengkapan: 'Lengkap', status_verifikasi: 'Menunggu Verifikasi' }],
      ['Rizky Hidayat', 'JDW-002', { status_kelengkapan: 'Belum Lengkap', catatan_kelengkapan: 'KHS belum diunggah.', status_verifikasi: 'Menunggu Verifikasi' }],
      ['Nur Aisyah', 'JDW-003', { status_verifikasi: 'Menunggu Verifikasi' }]
    ];
    contoh.forEach((c, i) => {
      const j = db.Jadwal.find(x => x.id_jadwal === c[1]);
      const no = 'LSPU-' + ym() + '-' + pad(i + 1, 4);
      db.Pendaftaran.push(Object.assign({
        no_reg: no, waktu_daftar: plus(-5 + i) + ' 09:1' + i + ':00', id_jadwal: c[1], id_skema: j.id_skema, nama: c[0],
        nik: '1271' + pad(i + 1, 12), nim: '52' + pad(i + 1, 8), tempat_lahir: 'Medan', tanggal_lahir: '2003-01-0' + (i + 1), jenis_kelamin: i % 2 ? 'Perempuan' : 'Laki-laki',
        email: 'peserta' + (i + 1) + '@contoh.id', hp: '08120000000' + i, alamat: 'Medan', instansi: 'Pendidikan Teknik Mesin, Unimed', pendidikan: 'SMA/SMK', pekerjaan: 'Mahasiswa', tujuan_asesmen: 'Sertifikasi',
        file_ktp: '#', file_foto: '#', file_ijazah: '#', file_apl02: '#', file_pendukung: '', file_apl01: '#',
        status_kelengkapan: 'Menunggu Pemeriksaan', catatan_kelengkapan: '', cek_berkas: '', tgl_kelengkapan: '', verifikasi_langsung: '', cek_persyaratan: '', rekomendasi_apl01: '',
        status_verifikasi: 'Menunggu Verifikasi', catatan_verifikasi: '', tgl_verifikasi: '', status_jadwal: 'Belum Dijadwalkan', id_asesor: '', id_tuk: '', tanggal_asesmen: '', waktu_asesmen: '',
        status_asesmen: 'Belum', catatan_asesmen: '', rekomendasi: '', tgl_hasil: '', link_surat_hasil: '', catatan_hasil: '', status_sertifikat: 'Belum Terbit', no_sertifikat: '', tgl_serah: '', penerima: '', diperbarui: now()
      }, c[2]));
      db.Log.push({ waktu: plus(-5 + i) + ' 09:1' + i + ':00', aktor: 'publik', peran: 'Pemohon', langkah_sop: '2', aksi: 'Permohonan sertifikasi diterima (APL-01)', ref: no, detail: '' });
      if (c[2].status_kelengkapan) db.Log.push({ waktu: plus(-5 + i) + ' 13:00:00', aktor: 'Administrator (Demo)', peran: 'Admin', langkah_sop: '2', aksi: 'Pemeriksaan kelengkapan berkas: ' + c[2].status_kelengkapan, ref: no, detail: c[2].catatan_kelengkapan || '' });
      if (c[2].status_verifikasi && c[2].status_verifikasi !== 'Menunggu Verifikasi') db.Log.push({ waktu: plus(-4 + i) + ' 10:00:00', aktor: 'Administrator (Demo)', peran: 'Admin', langkah_sop: '3', aksi: 'Verifikasi langsung berkas asli: ' + c[2].status_verifikasi, ref: no, detail: c[2].catatan_verifikasi || '' });
      if (c[2].status_jadwal) db.Log.push({ waktu: plus(-3 + i) + ' 11:00:00', aktor: 'Administrator (Demo)', peran: 'Admin', langkah_sop: '4', aksi: 'Penjadwalan: asesor & TUK ditetapkan, jadwal disampaikan', ref: no, detail: '' });
      if (c[2].rekomendasi) db.Log.push({ waktu: plus(-8) + ' 10:00:00', aktor: 'Administrator (Demo)', peran: 'Admin', langkah_sop: '7', aksi: 'Hasil sertifikasi disampaikan: ' + c[2].rekomendasi, ref: no, detail: '' });
    });
    db.seq['REG'] = contoh.length;
    db.Survei.push({ waktu: plus(-5) + ' 12:00:00', no_reg: '', skor_informasi: 5, skor_administrasi: 4, skor_asesmen: 5, skor_petugas: 5, skor_keseluruhan: 5, saran: 'Pelayanan cepat.' });
    return db;
  }

  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
  if (!db) db = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* memori saja */ } };
  const sessions = {};

  const fail = (m) => { throw new Error(m); };
  const nextId = (k, prefix, w) => { db.seq[k] = (db.seq[k] || 0) + 1; return prefix + pad(db.seq[k], w); };
  const log = (u, step, aksi, ref, detail) => db.Log.push({ waktu: now(), aktor: u.nama || u.username, peran: u.peran, langkah_sop: String(step), aksi, ref, detail: detail || '' });
  const mask = (n) => String(n || '').split(/\s+/).filter(String).map(w => w.length <= 2 ? w : w.slice(0, 2) + '*'.repeat(Math.min(w.length - 2, 5))).join(' ');
  const idx = (a, k) => { const m = {}; a.forEach(r => m[r[k]] = r); return m; };
  const buka = (j, isi) => j.status === 'Dibuka' && (!j.batas_daftar || j.batas_daftar >= today()) && (!(+j.kuota) || isi < +j.kuota);
  const isiJadwal = (id) => db.Pendaftaran.filter(r => r.id_jadwal === id && r.status_verifikasi !== 'Tidak Memenuhi Syarat').length;
  const KEYS = { Skema: 'id_skema', TUK: 'id_tuk', Asesor: 'id_asesor', Jadwal: 'id_jadwal', Dokumen: 'id_dok', Pengaturan: 'kunci' };
  const PREF = { Skema: 'SKM', TUK: 'TUK', Asesor: 'ASR', Jadwal: 'JDW', Dokumen: 'DOK' };
  const LAY = { 'Banding Asesmen': 'BDG', 'Surveilans': 'SRV', 'Legalisir Sertifikat': 'LGL', 'Perpanjangan Sertifikat (RCC)': 'RCC' };

  function cari(no, email) {
    no = String(no || '').trim().toUpperCase(); email = String(email || '').trim().toLowerCase();
    if (!no || !email) fail('Isi No. Registrasi dan email yang didaftarkan.');
    const r = db.Pendaftaran.find(x => x.no_reg.toUpperCase() === no);
    if (!r || r.email.toLowerCase() !== email) fail('Data tidak ditemukan. Periksa kembali No. Registrasi dan email.');
    return r;
  }

  function view(r) {
    const S = idx(db.Skema, 'id_skema'), T = idx(db.TUK, 'id_tuk'), A = idx(db.Asesor, 'id_asesor'), J = idx(db.Jadwal, 'id_jadwal');
    const j = J[r.id_jadwal] || {};
    return Object.assign({}, r, {
      nik: r.nik.slice(0, 4) + '********' + r.nik.slice(-4), skema: (S[r.id_skema] || {}).nama_skema, kode_skema: (S[r.id_skema] || {}).kode_skema,
      jadwal_tanggal: j.tanggal, jadwal_waktu: j.waktu, asesor: (A[r.id_asesor] || {}).nama_asesor || '', tuk: (T[r.id_tuk] || {}).nama_tuk || '', tuk_alamat: (T[r.id_tuk] || {}).alamat || '',
      status_kelengkapan: r.status_kelengkapan || 'Menunggu Pemeriksaan', berkas: ['file_apl01', 'file_apl02', 'file_ktp', 'file_foto', 'file_ijazah', 'file_pendukung'].filter(k => r[k]),
      riwayat: db.Log.filter(l => l.ref === r.no_reg).map(l => ({ waktu: l.waktu, langkah_sop: l.langkah_sop, aksi: l.aksi }))
    });
  }

  const TAHAP = {
    kelengkapan: { l: 2, f: ['status_kelengkapan', 'catatan_kelengkapan', 'cek_berkas'], chk: v => { if (['Menunggu Pemeriksaan', 'Lengkap', 'Belum Lengkap'].indexOf(v.status_kelengkapan) < 0) fail('Status kelengkapan tidak valid.'); if (v.status_kelengkapan === 'Belum Lengkap' && !String(v.catatan_kelengkapan || '').trim()) fail('Tuliskan berkas apa yang belum lengkap pada catatan.'); }, auto: () => ({ tgl_kelengkapan: now() }), a: v => 'Pemeriksaan kelengkapan berkas: ' + v.status_kelengkapan, d: v => [v.cek_berkas ? 'Diperiksa: ' + v.cek_berkas : '', v.catatan_kelengkapan || ''].filter(String).join(' · ') },
    verifikasi: { l: 3, f: ['status_verifikasi', 'catatan_verifikasi', 'verifikasi_langsung', 'cek_persyaratan'], chk: v => { if (v.status_verifikasi === 'Memenuhi Syarat' && String(v.verifikasi_langsung) !== 'YA') fail('Memenuhi Syarat hanya bisa disimpan setelah berkas asli dicocokkan (verifikasi langsung).'); }, guard: (r, v, no) => { if (v.status_verifikasi !== 'Menunggu Verifikasi' && r.status_kelengkapan !== 'Lengkap') fail(no + ': berkas belum dinyatakan lengkap oleh Bagian Administrasi (L2).'); }, auto: v => ({ tgl_verifikasi: now(), rekomendasi_apl01: v.status_verifikasi === 'Memenuhi Syarat' ? 'Diterima' : v.status_verifikasi === 'Tidak Memenuhi Syarat' ? 'Tidak diterima' : '' }), a: v => (String(v.verifikasi_langsung) === 'YA' ? 'Verifikasi langsung berkas asli: ' : 'Verifikasi persyaratan: ') + v.status_verifikasi, d: v => v.catatan_verifikasi },
    plotting: { l: 4, f: ['id_asesor', 'id_tuk', 'tanggal_asesmen', 'waktu_asesmen'], guard: (r, v, no) => { if (r.status_verifikasi !== 'Memenuhi Syarat') fail(no + ': belum lolos verifikasi langsung (L3).'); }, chk: v => (!v.id_asesor || !v.id_tuk || !v.tanggal_asesmen) && fail('Asesor, TUK, dan tanggal wajib diisi.'), auto: () => ({ status_jadwal: 'Terjadwal' }), a: () => 'Penjadwalan: asesor & TUK ditetapkan, jadwal disampaikan', d: v => v.id_asesor + ' · ' + v.id_tuk + ' · ' + v.tanggal_asesmen },
    asesmen: { l: 5, f: ['status_asesmen', 'catatan_asesmen'], a: v => v.status_asesmen === 'Dokumen Siap' ? 'Administrasi asesmen: dokumen disiapkan' : 'Status asesmen: ' + v.status_asesmen, d: v => v.catatan_asesmen },
    pelaksanaan: { l: 6, f: ['status_asesmen', 'catatan_asesmen'], a: v => 'Pelaksanaan pelayanan sertifikasi: ' + v.status_asesmen, d: v => v.catatan_asesmen },
    hasil: { l: 7, f: ['rekomendasi', 'link_surat_hasil', 'catatan_hasil'], chk: v => ['Kompeten', 'Belum Kompeten'].indexOf(v.rekomendasi) < 0 && fail('Pilih Kompeten / Belum Kompeten.'), auto: v => ({ tgl_hasil: now(), status_asesmen: 'Selesai', status_sertifikat: v.rekomendasi === 'Kompeten' ? 'Diajukan ke BNSP' : 'Belum Terbit' }), a: v => 'Hasil sertifikasi disampaikan: ' + v.rekomendasi, d: v => v.catatan_hasil },
    sertifikat: { l: 8, f: ['status_sertifikat', 'no_sertifikat', 'penerima'], auto: v => v.status_sertifikat === 'Sudah Diserahkan' ? { tgl_serah: now() } : {}, a: v => 'Sertifikat: ' + v.status_sertifikat, d: v => [v.no_sertifikat, v.penerima ? 'diterima oleh ' + v.penerima : ''].filter(String).join(' · ') },
    data: { l: 2, f: ['nama', 'nim', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'email', 'hp', 'alamat', 'instansi', 'pendidikan', 'pekerjaan', 'id_jadwal'], a: () => 'Koreksi data pemohon', d: v => Object.keys(v).join(', ') }
  };

  const PUBLIC = {
    ping: () => ({ pesan: 'Mode demo aktif' }),
    publicData: () => {
      const S = idx(db.Skema, 'id_skema'), T = idx(db.TUK, 'id_tuk');
      return {
        pengaturan: db.Pengaturan,
        skema: db.Skema.filter(r => r.status !== 'Nonaktif'),
        tuk: db.TUK.filter(r => r.status !== 'Nonaktif'),
        jadwal: db.Jadwal.map(j => { const isi = isiJadwal(j.id_jadwal); const o = Object.assign({}, j, { nama_skema: (S[j.id_skema] || {}).nama_skema, kode_skema: (S[j.id_skema] || {}).kode_skema, nama_tuk: (T[j.id_tuk] || {}).nama_tuk, bisa_daftar: buka(j, isi) }); delete o.kuota; return o; }).sort((a, b) => a.tanggal.localeCompare(b.tanggal)),
        dokumen: db.Dokumen.filter(r => r.status !== 'Nonaktif'),
        statistik: { skema: db.Skema.length, tuk: db.TUK.length, asesor: db.Asesor.length, asesi: db.Pendaftaran.length, kompeten: db.Pendaftaran.filter(r => r.rekomendasi === 'Kompeten').length }
      };
    },
    daftar: (d) => {
      ['id_jadwal', 'nama', 'nik', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'email', 'hp', 'alamat', 'pendidikan', 'tujuan_asesmen'].forEach(k => { if (!String(d[k] || '').trim()) fail('Kolom "' + k.replace(/_/g, ' ') + '" wajib diisi.'); });
      if (!/^\d{16}$/.test(d.nik)) fail('NIK harus 16 digit angka.');
      if (!d.setuju) fail('Anda harus menyetujui pernyataan pendaftaran.');
      if (!d.setuju_persyaratan) fail('Centang pernyataan bahwa Anda memenuhi persyaratan skema.');
      const j = db.Jadwal.find(x => x.id_jadwal === d.id_jadwal) || fail('Jadwal tidak ditemukan.');
      if (!buka(j, isiJadwal(j.id_jadwal))) fail('Pendaftaran untuk jadwal ini sudah ditutup atau kuota penuh.');
      const dobel = db.Pendaftaran.find(r => r.id_jadwal === d.id_jadwal && r.nik === d.nik && r.status_verifikasi !== 'Tidak Memenuhi Syarat');
      if (dobel) fail('NIK ini sudah terdaftar pada jadwal yang sama (No. Registrasi ' + dobel.no_reg + ').');
      const f = d.files || {};
      if (!f.file_apl01) fail('APL-01 yang telah diisi dan ditandatangani wajib diunggah.');
      if (!f.file_ktp) fail('Scan KTP wajib diunggah.');
      if (!f.file_foto) fail('Pas foto wajib diunggah.');
      const no = nextId('REG', 'LSPU-' + ym() + '-', 4);
      const r = { no_reg: no, waktu_daftar: now(), id_jadwal: j.id_jadwal, id_skema: j.id_skema, status_kelengkapan: 'Menunggu Pemeriksaan', catatan_kelengkapan: '', cek_berkas: '', tgl_kelengkapan: '', verifikasi_langsung: '', cek_persyaratan: '', rekomendasi_apl01: '', status_verifikasi: 'Menunggu Verifikasi', catatan_verifikasi: '', tgl_verifikasi: '', status_jadwal: 'Belum Dijadwalkan', id_asesor: '', id_tuk: '', tanggal_asesmen: '', waktu_asesmen: '', status_asesmen: 'Belum', catatan_asesmen: '', rekomendasi: '', tgl_hasil: '', link_surat_hasil: '', catatan_hasil: '', status_sertifikat: 'Belum Terbit', no_sertifikat: '', tgl_serah: '', penerima: '', diperbarui: now() };
      ['nama', 'nik', 'nim', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'email', 'hp', 'alamat', 'instansi', 'pendidikan', 'pekerjaan', 'tujuan_asesmen'].forEach(k => r[k] = String(d[k] || ''));
      r.email = r.email.toLowerCase();
      ['file_apl01', 'file_ktp', 'file_foto', 'file_ijazah', 'file_apl02', 'file_pendukung'].forEach(k => r[k] = f[k] ? '#demo-berkas' : '');
      db.Pendaftaran.push(r);
      log({ username: 'publik', peran: 'Pemohon' }, 2, 'Permohonan sertifikasi diterima (APL-01)', no, 'Jadwal ' + j.id_jadwal);
      const sk = db.Skema.find(x => x.id_skema === j.id_skema) || {}, tk = db.TUK.find(x => x.id_tuk === j.id_tuk) || {};
      return { no_reg: no, nama: r.nama, nik: r.nik.slice(0, 4) + '********' + r.nik.slice(-4), email: r.email, hp: r.hp, skema: sk.nama_skema, kode_skema: sk.kode_skema, tanggal: j.tanggal, waktu: j.waktu, tuk: tk.nama_tuk, waktu_daftar: r.waktu_daftar, status_verifikasi: r.status_verifikasi, status_kelengkapan: r.status_kelengkapan, email_terkirim: false };
    },
    lacak: (d) => view(cari(d.no_reg, d.email)),
    unggahUlang: (d) => {
      const r = cari(d.no_reg, d.email);
      if (r.status_kelengkapan !== 'Belum Lengkap' && r.status_verifikasi !== 'Perlu Perbaikan') fail('Unggah ulang hanya bisa dilakukan bila berkas dinyatakan belum lengkap atau perlu perbaikan.');
      const f = d.files || {}, ks = Object.keys(f).filter(k => /^file_/.test(k) && f[k]);
      if (!ks.length) fail('Pilih minimal satu berkas untuk diunggah ulang.');
      ks.forEach(k => r[k] = '#demo-berkas');
      Object.assign(r, { status_kelengkapan: 'Menunggu Pemeriksaan', status_verifikasi: 'Menunggu Verifikasi', diperbarui: now() });
      log({ username: 'publik', peran: 'Pemohon' }, 2, 'Unggah ulang berkas persyaratan', r.no_reg, ks.join(', '));
      return { no_reg: r.no_reg, berkas: ks };
    },
    plotting: () => {
      const S = idx(db.Skema, 'id_skema'), T = idx(db.TUK, 'id_tuk'), A = idx(db.Asesor, 'id_asesor'), J = idx(db.Jadwal, 'id_jadwal');
      return db.Pendaftaran.filter(r => r.status_jadwal === 'Terjadwal').map(r => ({ no_reg: r.no_reg, nama: mask(r.nama), id_jadwal: r.id_jadwal, jadwal_label: (S[r.id_skema] || {}).nama_skema + ' — ' + (J[r.id_jadwal] || {}).tanggal, skema: (S[r.id_skema] || {}).nama_skema, tanggal: r.tanggal_asesmen, waktu: r.waktu_asesmen, tuk: (T[r.id_tuk] || {}).nama_tuk, asesor: (A[r.id_asesor] || {}).nama_asesor }));
    },
    keluhan: (d) => {
      ['nama', 'email', 'kategori', 'isi'].forEach(k => { if (!String(d[k] || '').trim()) fail('Kolom "' + k + '" wajib diisi.'); });
      const no = nextId('KLH', 'KLH-' + ym() + '-', 3);
      db.Keluhan.push({ no_tiket: no, waktu: now(), nama: d.nama, email: d.email.toLowerCase(), hp: d.hp || '', no_reg: d.no_reg || '', kategori: d.kategori, isi: d.isi, status: 'Diterima', tindak_lanjut: '', tgl_selesai: '', petugas: '' });
      log({ username: 'publik', peran: 'Pemohon' }, 9, 'Keluhan diterima dan dicatat', no, d.kategori);
      return { no_tiket: no };
    },
    layanan: (d) => {
      const p = LAY[d.jenis] || fail('Jenis layanan tidak dikenal.');
      ['nama', 'email', 'hp'].forEach(k => { if (!String(d[k] || '').trim()) fail('Kolom "' + k + '" wajib diisi.'); });
      if (d.jenis === 'Banding Asesmen') { cari(d.no_reg, d.email); if (!d.keterangan) fail('Alasan banding wajib diisi.'); }
      const no = nextId(p, p + '-' + ym() + '-', 3);
      db.Layanan.push({ no_layanan: no, waktu: now(), jenis: d.jenis, nama: d.nama, email: d.email.toLowerCase(), hp: d.hp, no_reg: d.no_reg || '', no_sertifikat: d.no_sertifikat || '', skema: d.skema || '', keterangan: d.keterangan || '', file: d.file ? '#demo-berkas' : '', status: 'Diterima', catatan_petugas: '', tgl_selesai: '', petugas: '' });
      log({ username: 'publik', peran: 'Pemohon' }, d.jenis === 'Banding Asesmen' ? 7 : 1, 'Permohonan ' + d.jenis + ' diterima', no, d.no_reg || d.no_sertifikat || '');
      return { no_layanan: no };
    },
    cekTiket: (d) => {
      const no = String(d.no || '').trim().toUpperCase(), em = String(d.email || '').trim().toLowerCase();
      let r = db.Keluhan.find(x => x.no_tiket === no);
      if (r) { if (r.email !== em) fail('Email tidak sesuai dengan tiket.'); return { no: r.no_tiket, jenis: 'Keluhan: ' + r.kategori, waktu: r.waktu, status: r.status, tanggapan: r.tindak_lanjut, selesai: r.tgl_selesai, isi: r.isi }; }
      r = db.Layanan.find(x => x.no_layanan === no);
      if (r) { if (r.email !== em) fail('Email tidak sesuai dengan tiket.'); return { no: r.no_layanan, jenis: r.jenis, waktu: r.waktu, status: r.status, tanggapan: r.catatan_petugas, selesai: r.tgl_selesai, isi: r.keterangan }; }
      fail('Nomor tiket tidak ditemukan.');
    },
    survei: (d) => {
      const k = ['skor_informasi', 'skor_administrasi', 'skor_asesmen', 'skor_petugas', 'skor_keseluruhan'];
      k.forEach(x => { if (!(+d[x] >= 1 && +d[x] <= 5)) fail('Semua penilaian wajib diisi (1–5).'); });
      const r = { waktu: now(), no_reg: d.no_reg || '', saran: d.saran || '' }; k.forEach(x => r[x] = +d[x]);
      db.Survei.push(r); return { terima_kasih: true };
    },
    login: (d) => {
      const u = db.Pengguna.find(x => x.username === String(d.username || '').toLowerCase().trim());
      if (!u || u.password !== d.password || u.aktif === 'TIDAK') fail('Username atau password salah. (Demo: admin / demo12345)');
      const token = 'demo-' + Math.random().toString(36).slice(2);
      const s = { username: u.username, nama: u.nama, peran: u.peran };
      sessions[token] = s;
      try { sessionStorage.setItem('sipintar_demo_sess_' + token, JSON.stringify(s)); } catch (e) { /* abaikan */ }
      log(s, 10, 'Login admin', u.username, '');
      return { token, user: s };
    }
  };

  const ADMIN = {
    me: (d, u) => u,
    logout: () => true,
    summary: () => {
      const p = db.Pendaftaran, c = f => p.filter(f).length, sv = db.Survei;
      return {
        total: p.length, menunggu_kelengkapan: c(r => (r.status_kelengkapan || 'Menunggu Pemeriksaan') !== 'Lengkap' && r.status_verifikasi !== 'Tidak Memenuhi Syarat'), menunggu_verifikasi: c(r => r.status_kelengkapan === 'Lengkap' && (r.status_verifikasi === 'Menunggu Verifikasi' || r.status_verifikasi === 'Perlu Perbaikan')), perlu_perbaikan: c(r => r.status_verifikasi === 'Perlu Perbaikan'),
        siap_dijadwalkan: c(r => r.status_verifikasi === 'Memenuhi Syarat' && r.status_jadwal !== 'Terjadwal'), terjadwal: c(r => r.status_jadwal === 'Terjadwal' && !r.rekomendasi),
        kompeten: c(r => r.rekomendasi === 'Kompeten'), belum_kompeten: c(r => r.rekomendasi === 'Belum Kompeten'),
        sertifikat_proses: c(r => r.rekomendasi === 'Kompeten' && r.status_sertifikat !== 'Sudah Diserahkan'), sertifikat_diserahkan: c(r => r.status_sertifikat === 'Sudah Diserahkan'),
        keluhan_terbuka: db.Keluhan.filter(r => ['Selesai', 'Ditolak'].indexOf(r.status) < 0).length, layanan_terbuka: db.Layanan.filter(r => ['Selesai', 'Ditolak'].indexOf(r.status) < 0).length,
        survei_n: sv.length, survei_rata: sv.length ? Math.round(sv.reduce((a, r) => a + (+r.skor_keseluruhan), 0) / sv.length * 100) / 100 : 0,
        logs: db.Log.slice(-20).reverse()
      };
    },
    listPendaftar: () => db.Pendaftaran.slice().reverse(),
    refData: () => ({ Skema: db.Skema, TUK: db.TUK, Asesor: db.Asesor, Jadwal: db.Jadwal }),
    detailPendaftar: (d) => {
      const r = db.Pendaftaran.find(x => x.no_reg === d.no_reg) || fail('Data tidak ditemukan.');
      return { data: r, logs: db.Log.filter(l => l.ref === d.no_reg), layanan: db.Layanan.filter(l => l.no_reg === d.no_reg), keluhan: db.Keluhan.filter(l => l.no_reg === d.no_reg) };
    },
    updatePendaftar: (d, u) => {
      const T = TAHAP[d.tahap] || fail('Tahap tidak dikenal.');
      const regs = [].concat(d.no_regs || d.no_reg || []);
      if (!regs.length) fail('Pilih minimal satu peserta.');
      const v = d.nilai || {};
      T.chk && T.chk(v);
      const patch = {}; T.f.forEach(k => { if (v[k] !== undefined) patch[k] = String(v[k]); });
      if (T.auto) Object.assign(patch, T.auto(v));
      patch.diperbarui = now();
      if (T.guard) regs.forEach(no => { const r = db.Pendaftaran.find(x => x.no_reg === no); if (!r) fail('Data ' + no + ' tidak ditemukan.'); T.guard(r, v, no); });
      regs.forEach(no => { const r = db.Pendaftaran.find(x => x.no_reg === no); if (!r) fail('Data ' + no + ' tidak ditemukan.'); Object.assign(r, patch); log(u, T.l, T.a(v), no, T.d ? T.d(v) : ''); });
      return { diperbarui: regs.length };
    },
    listSheet: (d) => {
      if (d.sheet === 'Pengaturan') return Object.keys(db.Pengaturan).map(k => ({ kunci: k, nilai: db.Pengaturan[k], keterangan: '' }));
      if (d.sheet === 'Log') return db.Log.slice(-1000).reverse();
      return (db[d.sheet] || fail('Sheet tidak diizinkan.')).slice();
    },
    saveRow: (d, u) => {
      if (d.sheet === 'Pengaturan') { db.Pengaturan[d.row.kunci] = d.row.nilai; log(u, 1, 'Ubah data Pengaturan', d.row.kunci); return { id: d.row.kunci }; }
      const k = KEYS[d.sheet] || fail('Sheet tidak diizinkan.');
      const arr = db[d.sheet];
      let id = d.row[k];
      const ada = id && arr.find(r => r[k] === id);
      if (ada && !d.isNew) Object.assign(ada, d.row);
      else {
        if (ada) fail('ID ' + id + ' sudah dipakai.');
        if (!id) { let max = 0; arr.forEach(r => { max = Math.max(max, +String(r[k]).split('-')[1] || 0); }); id = PREF[d.sheet] + '-' + pad(max + 1, 3); }
        arr.push(Object.assign({}, d.row, { [k]: id }));
      }
      log(u, 1, (ada ? 'Ubah' : 'Tambah') + ' data ' + d.sheet, id);
      return { id };
    },
    deleteRow: (d, u) => {
      if (u.peran !== 'Admin') fail('Hanya Admin.');
      const k = KEYS[d.sheet];
      if (d.sheet === 'Pengaturan') delete db.Pengaturan[d.id];
      else db[d.sheet] = db[d.sheet].filter(r => r[k] !== d.id);
      log(u, 10, 'Hapus data ' + d.sheet, d.id); return true;
    },
    updateTiket: (d, u) => {
      const isK = d.sheet === 'Keluhan';
      const r = (isK ? db.Keluhan.find(x => x.no_tiket === d.id) : db.Layanan.find(x => x.no_layanan === d.id)) || fail('Tiket tidak ditemukan.');
      r.status = d.status; r.petugas = u.nama; r[isK ? 'tindak_lanjut' : 'catatan_petugas'] = d.catatan || '';
      if (d.status === 'Selesai' || d.status === 'Ditolak') r.tgl_selesai = now();
      log(u, isK ? 9 : 7, (isK ? 'Tindak lanjut keluhan: ' : 'Proses layanan: ') + d.status, d.id, d.catatan); return true;
    },
    listUsers: () => db.Pengguna.map(u => ({ username: u.username, nama: u.nama, peran: u.peran, aktif: u.aktif })),
    saveUser: (d, u) => {
      const un = String(d.username || '').toLowerCase().trim();
      if (!/^[a-z0-9._]{3,30}$/.test(un)) fail('Username 3–30 karakter: huruf kecil, angka, titik, garis bawah.');
      let x = db.Pengguna.find(p => p.username === un);
      if (!x) { if (!d.password) fail('Password wajib untuk pengguna baru.'); x = { username: un }; db.Pengguna.push(x); }
      if (d.password && d.password.length < 8) fail('Password minimal 8 karakter.');
      Object.assign(x, { nama: d.nama || un, peran: d.peran, aktif: d.aktif || 'YA' }); if (d.password) x.password = d.password;
      log(u, 10, 'Tambah/ubah pengguna', un, d.peran); return true;
    },
    changePassword: (d, u) => {
      const x = db.Pengguna.find(p => p.username === u.username);
      if (!x || x.password !== d.lama) fail('Password lama salah.');
      if (String(d.baru || '').length < 8) fail('Password baru minimal 8 karakter.');
      x.password = d.baru; return true;
    }
  };

  window.SIPINTAR_MOCK = {
    reset() { db = seed(); save(); },
    async call(action, data, token) {
      await new Promise(r => setTimeout(r, 180));
      const copy = (x) => JSON.parse(JSON.stringify(x));
      if (PUBLIC[action]) { const r = PUBLIC[action](copy(data)); save(); return copy(r); }
      if (ADMIN[action]) {
        let s = sessions[token];
        if (!s) { try { s = JSON.parse(sessionStorage.getItem('sipintar_demo_sess_' + token)); } catch (e) { s = null; } }
        if (!s) fail('Sesi berakhir. Silakan login kembali.');
        const r = ADMIN[action](copy(data), s); save(); return copy(r);
      }
      fail('Aksi tidak dikenal: ' + action);
    }
  };
})();
