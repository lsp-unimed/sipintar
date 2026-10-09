/* SIPINTAR LSP UNIMED — fungsi bersama (API, utilitas UI, data SOP) */
(function () {
  const CFG = window.SIPINTAR_CONFIG || {};
  const DEMO = !CFG.API_URL;

  /* ---------------- Penyimpanan aman ---------------- */
  const store = {
    // Bawaan: sessionStorage (hilang saat tab/aplikasi ditutup).
    // Kunci yang disimpan dengan "ingat saya" ditaruh di localStorage agar bertahan di perangkat ini.
    get(k) { try { return sessionStorage.getItem(k) || localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v, ingat) {
      try { if (ingat) { localStorage.setItem(k, v); sessionStorage.removeItem(k); } else { sessionStorage.setItem(k, v); localStorage.removeItem(k); } } catch (e) { /* abaikan */ }
    },
    del(k) { try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
  };

  /* ---------------- API ---------------- */
  async function api(action, data = {}) {
    const token = store.get('sipintar_token');
    if (DEMO) return window.SIPINTAR_MOCK.call(action, data, token);
    let res;
    try {
      res = await fetch(CFG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, data, token })
      });
    } catch (e) {
      throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
    }
    let j;
    try { j = await res.json(); } catch (e) { throw new Error('Respons server tidak valid. Pastikan Apps Script sudah di-deploy dengan akses "Siapa saja".'); }
    if (!j.ok) {
      if (/Sesi berakhir/.test(j.error || '')) store.del('sipintar_token');
      throw new Error(j.error || 'Terjadi kesalahan.');
    }
    return j.data;
  }

  /* ---------------- Utilitas ---------------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  function tgl(s, withDay) {
    if (!s) return '-';
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!m) return esc(s);
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    let out = (withDay ? HARI[d.getDay()] + ', ' : '') + (+m[3]) + ' ' + BULAN[+m[2] - 1] + ' ' + m[1];
    if (m[4]) out += ', ' + m[4] + '.' + m[5];
    return out;
  }
  const rupiah = (n) => (Number(n) || 0) === 0 ? 'Gratis / ditanggung' : 'Rp ' + Number(n).toLocaleString('id-ID');
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  function badge(s) {
    const map = {
      ok: ['Lengkap', 'Diterima', 'Memenuhi Syarat', 'Terjadwal', 'Kompeten', 'Sudah Diserahkan', 'Selesai', 'Dibuka', 'Aktif', 'Hadir', 'YA'],
      warn: ['Menunggu Pemeriksaan', 'Belum Lengkap', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Diajukan ke BNSP', 'Diproses', 'Dokumen Siap', 'Belum Dijadwalkan', 'Diterima'],
      bad: ['Tidak diterima', 'Tidak Memenuhi Syarat', 'Belum Kompeten', 'Ditolak', 'Ditutup', 'Tidak Hadir', 'Nonaktif', 'TIDAK'],
      info: ['Siap Diambil', 'Selesai Asesmen']
    };
    let cls = '';
    for (const k in map) if (map[k].indexOf(s) >= 0) cls = k;
    return s ? `<span class="badge ${cls}">${esc(s)}</span>` : '<span class="badge">-</span>';
  }

  function toast(msg, type = '') {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), type === 'bad' ? 6000 : 3500);
  }

  function modal(title, html, opts = {}) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><h2>${esc(title)}</h2><div style="display:flex;gap:8px;align-items:center">${opts.headExtra || ''}<button class="modal-close" aria-label="Tutup">&times;</button></div></div>
      <div class="modal-body">${html}</div></div>`;
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); opts.onClose && opts.onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    $('.modal-close', back).onclick = close;
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    return { el: back, body: $('.modal-body', back), close };
  }

  const loading = (txt = 'Memuat data…') => `<div class="loading"><div class="spin"></div>${esc(txt)}</div>`;

  function fileToPayload(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      const max = (CFG.MAX_FILE_MB || 2) * 1024 * 1024;
      const okType = ['application/pdf', 'image/jpeg', 'image/png'];
      if (okType.indexOf(file.type) < 0) return reject(new Error(`Berkas "${file.name}" harus PDF, JPG, atau PNG.`));
      if (file.size > max) return reject(new Error(`Berkas "${file.name}" melebihi ${CFG.MAX_FILE_MB || 2} MB.`));
      const r = new FileReader();
      r.onload = () => resolve({ name: file.name, type: file.type, data: String(r.result).split(',')[1] });
      r.onerror = () => reject(new Error('Gagal membaca berkas ' + file.name));
      r.readAsDataURL(file);
    });
  }

  function formData(form) {
    const o = {};
    $$('input,select,textarea', form).forEach(el => {
      if (!el.name || el.type === 'file') return;
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
      else o[el.name] = el.value.trim();
    });
    return o;
  }

  async function busy(btn, fn) {
    const old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spin" style="width:16px;height:16px;border-width:2px"></span> Memproses…';
    try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = old; }
  }

  function copy(text) {
    try { navigator.clipboard.writeText(text); toast('Disalin: ' + text, 'ok'); } catch (e) { toast('Salin manual: ' + text); }
  }

  /** Tautan eksternal hanya boleh https:// (cegah javascript: dsb.). */
  const safeUrl = (u) => /^https:\/\/[^\s"'<>]+$/i.test(String(u || '').trim()) ? esc(String(u).trim()) : '#';

  function csv(rows, cols, filename) {
    // awali dengan ' bila sel diawali = + - @ agar tidak dieksekusi sebagai rumus di Excel/Sheets
    const q = (v) => { let t = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
    const lines = [cols.map(c => q(c.label || c.key)).join(',')].concat(rows.map(r => cols.map(c => q(r[c.key])).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------------- Ikon (garis, 24px) ---------------- */
  const P = {
    home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
    flow: 'M4 6h6v4H4zM14 14h6v4h-6zM7 10v4a2 2 0 002 2h5',
    book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5',
    file: 'M7 3h7l5 5v13H7zM14 3v5h5',
    cal: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4',
    search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    check: 'M4 12l5 5L20 6',
    award: 'M12 3a6 6 0 100 12 6 6 0 000-12zM8.5 14L7 21l5-3 5 3-1.5-7',
    scale: 'M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 006 0zM18 7l-3 7a3 3 0 006 0z',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
    stamp: 'M9 4h6l-1 7h-4zM5 15h14v3H5zM7 21h10',
    refresh: 'M4 4v6h6M20 20v-6h-6M5 13a7 7 0 0012 4M19 11A7 7 0 007 7',
    chat: 'M4 5h16v11H8l-4 4z',
    ticket: 'M4 7h16v3a2 2 0 000 4v3H4v-3a2 2 0 000-4z',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    users: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M17 11a3 3 0 100-6M22 21a5 5 0 00-5-5',
    user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
    pin: 'M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12zM12 7a2 2 0 100 4 2 2 0 000-4z',
    log: 'M5 4h14v16H5zM9 8h6M9 12h6M9 16h4',
    gear: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12l2-1-1-3-2 .3-1.5-1.5L17 5l-3-1-1 2h-2L10 4 7 5l.5 2L6 8.5 4 8.3 3 11l2 1v0l-2 1 1 3 2-.3 1.5 1.5L7 19l3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .3 1-3z',
    lock: 'M6 11h12v10H6zM8 11V7a4 4 0 018 0v4',
    logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
    menu: 'M4 6h16M4 12h16M4 18h16',
    plus: 'M12 5v14M5 12h14',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    print: 'M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z',
    send: 'M4 12l16-8-6 16-3-6z',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    chev: 'M6 9l6 6 6-6',
    x: 'M6 6l12 12M18 6L6 18'
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n] || ''}"/></svg>`;

  /** Pola guilloche (motif pengaman sertifikat) sebagai SVG dekoratif. */
  function guilloche() {
    const c = 380, parts = [];
    for (let i = 0; i < 48; i++) parts.push(`<ellipse cx="${c}" cy="${c}" rx="330" ry="118" transform="rotate(${(i * 7.5).toFixed(1)} ${c} ${c})"/>`);
    [300, 230, 160].forEach((R, k) => {
      let d = '';
      for (let t = 0; t <= 720; t++) {
        const a = t / 720 * Math.PI * 2;
        const r = R + (14 - k * 3) * Math.sin(a * (36 - k * 8));
        d += (t ? 'L' : 'M') + (c + r * Math.cos(a)).toFixed(1) + ' ' + (c + r * Math.sin(a)).toFixed(1);
      }
      parts.push(`<path d="${d}Z"/>`);
    });
    return `<svg class="guilloche" viewBox="0 0 760 760" fill="none" stroke="currentColor" stroke-width=".7" aria-hidden="true">${parts.join('')}</svg>`;
  }

  /* ---------------- Data SOP (XVII/SOP-PKS, Rev. 03/00) ---------------- */
  const SOP = {
    nomor: 'XVII/SOP-PKS', revisi: '03/00', judul: 'Pelayanan Kegiatan Sertifikasi', berlaku: '2026',
    tujuan: 'Menjamin bahwa pelayanan kegiatan sertifikasi kompetensi dilaksanakan secara profesional, objektif, transparan, cepat, tepat, terdokumentasi, dan mampu telusur sesuai persyaratan PBNSP, ISO/IEC 17024, serta regulasi teknis terkait guna meningkatkan kepuasan pemohon sertifikasi.',
    ruang: 'Pelayanan informasi sertifikasi, penerimaan permohonan sertifikasi, registrasi peserta, verifikasi persyaratan, pelayanan administrasi sertifikasi, koordinasi pelaksanaan asesmen, penyampaian hasil sertifikasi, penanganan keluhan layanan, serta pengendalian rekaman pelayanan sertifikasi pada seluruh skema sertifikasi LSP UNIMED.',
    koordinator: 'Bagian Sertifikasi dan Sekretariat LSP',
    acuan: [
      'PBNSP 201 tentang Persyaratan Umum Lembaga Sertifikasi Profesi',
      'PBNSP 202 tentang Pelaksanaan Sertifikasi Kompetensi',
      'PBNSP 206 tentang Sistem Manajemen Mutu LSP',
      'ISO/IEC 17024:2012 Conformity Assessment – General Requirements for Bodies Operating Certification of Persons',
      'SKKNI Nomor 333 Tahun 2020 Bidang Standardisasi, Pelatihan Kerja dan Sertifikasi'
    ],
    langkah: [
      { no: 1, nama: 'Pelayanan Informasi Sertifikasi', instruksi: ['Memberikan informasi terkait skema sertifikasi, persyaratan, biaya, jadwal, dan proses sertifikasi kepada pemohon.', 'Menyediakan formulir dan panduan sertifikasi.'], media: 'Brosur/panduan sertifikasi, formulir pendaftaran', pj: 'Sekretariat LSP', fitur: ['Skema Sertifikasi', 'Jadwal', 'Dokumen Mutu'], link: '#/skema' },
      { no: 2, nama: 'Penerimaan Permohonan Sertifikasi', instruksi: ['Menerima dokumen permohonan sertifikasi dari peserta.', 'Memeriksa kelengkapan administrasi dan persyaratan peserta.', 'Memberikan nomor registrasi peserta.'], media: 'Formulir APL 01 dan APL 02, daftar registrasi peserta', pj: 'Bagian Administrasi', fitur: ['Formulir Pendaftaran Online + APL-01', 'Nomor Registrasi Otomatis', 'Pemeriksaan Kelengkapan Berkas'], link: '#/jadwal' },
      { no: 3, nama: 'Verifikasi Persyaratan Peserta', instruksi: ['Memverifikasi dokumen peserta sesuai persyaratan skema sertifikasi.', 'Mengonfirmasi kesesuaian bukti kompetensi peserta.'], media: 'Hasil verifikasi dokumen', pj: 'Bagian Sertifikasi', fitur: ['Verifikasi Langsung Berkas Asli', 'Rekomendasi APL-01'], link: '#/status' },
      { no: 4, nama: 'Penjadwalan Sertifikasi', instruksi: ['Menyusun jadwal asesmen kompetensi.', 'Menentukan asesor kompetensi dan TUK sesuai skema sertifikasi.', 'Menyampaikan jadwal kepada peserta.'], media: 'Jadwal asesmen kompetensi', pj: 'Bagian Sertifikasi', fitur: ['Plotting Jadwal & TUK'], link: '#/plotting' },
      { no: 5, nama: 'Pelayanan Administrasi Asesmen', instruksi: ['Menyiapkan dokumen asesmen dan administrasi kegiatan sertifikasi.', 'Menyediakan kebutuhan administrasi selama asesmen berlangsung.'], media: 'Dokumen asesmen dan administrasi', pj: 'Sekretariat LSP', fitur: ['Status Pendaftaran'], link: '#/status' },
      { no: 6, nama: 'Pelaksanaan Pelayanan Sertifikasi', instruksi: ['Mendampingi peserta selama proses sertifikasi berlangsung.', 'Memberikan pelayanan yang adil, profesional, dan bebas diskriminasi.', 'Menjaga kerahasiaan data peserta.'], media: 'Rekaman pelayanan sertifikasi', pj: 'Bagian Sertifikasi', fitur: ['Status Pendaftaran'], link: '#/status' },
      { no: 7, nama: 'Penyampaian Hasil Sertifikasi', instruksi: ['Menyampaikan hasil sertifikasi kepada peserta secara resmi.', 'Memberikan informasi terkait hak banding dan keluhan.'], media: 'Surat pemberitahuan hasil sertifikasi', pj: 'Bagian Sertifikasi', fitur: ['Hasil Uji Kompetensi', 'Banding Asesmen'], link: '#/hasil' },
      { no: 8, nama: 'Penyerahan Sertifikat Kompetensi', instruksi: ['Menyerahkan sertifikat kompetensi kepada peserta yang dinyatakan kompeten.', 'Mendokumentasikan penyerahan sertifikat.'], media: 'Sertifikat kompetensi, tanda terima sertifikat', pj: 'Bagian Administrasi', fitur: ['Tracer Sertifikat'], link: '#/sertifikat' },
      { no: 9, nama: 'Penanganan Keluhan Pelayanan', instruksi: ['Menerima dan mencatat keluhan terkait pelayanan sertifikasi.', 'Menindaklanjuti keluhan sesuai prosedur penanganan keluhan.'], media: 'Formulir keluhan pelayanan', pj: 'Bagian Manajemen Mutu', fitur: ['Keluhan Layanan', 'Lacak Tiket'], link: '#/keluhan' },
      { no: 10, nama: 'Pengendalian Rekaman Pelayanan', instruksi: ['Menyimpan seluruh dokumen dan rekaman pelayanan sertifikasi secara aman dan mampu telusur.', 'Menjaga kerahasiaan data dan informasi peserta.'], media: 'Arsip pelayanan sertifikasi', pj: 'Sekretariat LSP', fitur: ['Rekaman & Log (admin)'], link: '#/alur' }
    ],
    dokumenTerkait: 'Formulir APL 01, APL 02, jadwal asesmen, formulir registrasi peserta, dokumen asesmen, surat hasil sertifikasi, sertifikat kompetensi, formulir keluhan pelayanan.',
    catatanMutu: 'Seluruh pelayanan kegiatan sertifikasi wajib dilaksanakan secara profesional, objektif, transparan, responsif, terdokumentasi, dan mampu telusur guna menjamin kepuasan peserta serta kesesuaian dengan persyaratan PBNSP dan ISO/IEC 17024.'
  };

  /** Hitung status 10 langkah untuk satu peserta (dipakai halaman publik & admin). */
  function tahapPeserta(r) {
    const v = r.status_verifikasi;
    const as = r.status_asesmen || 'Belum';
    const s = (st, info) => ({ st, info: info || '' });
    const out = {};
    const kl = r.status_kelengkapan || 'Menunggu Pemeriksaan';
    out[2] = kl === 'Lengkap' ? s('done', 'Berkas lengkap' + (r.tgl_kelengkapan ? ' · ' + tgl(r.tgl_kelengkapan) : ''))
      : kl === 'Belum Lengkap' ? s('now', 'Berkas belum lengkap — unggah ulang') : s('now', 'Terdaftar ' + tgl(r.waktu_daftar) + ' · menunggu pemeriksaan kelengkapan');
    out[3] = v === 'Memenuhi Syarat' ? s('done', 'Lolos verifikasi langsung' + (r.tgl_verifikasi ? ' · ' + tgl(r.tgl_verifikasi) : ''))
      : v === 'Tidak Memenuhi Syarat' ? s('fail', 'Tidak memenuhi syarat')
        : v === 'Perlu Perbaikan' ? s('now', 'Perlu perbaikan dokumen')
          : kl === 'Lengkap' ? s('now', 'Datang untuk verifikasi langsung dengan berkas asli') : s('wait', '');
    const verOk = v === 'Memenuhi Syarat';
    out[4] = r.status_jadwal === 'Terjadwal' ? s('done', tgl(r.tanggal_asesmen, true) + (r.waktu_asesmen ? ' · ' + r.waktu_asesmen : '')) : s(verOk ? 'now' : 'wait', verOk ? 'Menunggu penetapan asesor & TUK' : '');
    const terjadwal = r.status_jadwal === 'Terjadwal';
    out[5] = ['Dokumen Siap', 'Hadir', 'Selesai'].indexOf(as) >= 0 ? s('done', 'Dokumen asesmen disiapkan') : s(terjadwal ? 'now' : 'wait', terjadwal ? 'Persiapan dokumen asesmen' : '');
    out[6] = as === 'Hadir' || as === 'Selesai' ? s('done', 'Asesmen dilaksanakan') : as === 'Tidak Hadir' ? s('fail', 'Tidak hadir') : s(as === 'Dokumen Siap' ? 'now' : 'wait');
    out[7] = r.rekomendasi === 'Kompeten' ? s('done', 'KOMPETEN · ' + tgl(r.tgl_hasil)) : r.rekomendasi === 'Belum Kompeten' ? s('fail', 'BELUM KOMPETEN · ' + tgl(r.tgl_hasil)) : s(as === 'Hadir' || as === 'Selesai' ? 'now' : 'wait', as === 'Hadir' ? 'Menunggu keputusan sertifikasi' : '');
    const sert = r.status_sertifikat;
    out[8] = sert === 'Sudah Diserahkan' ? s('done', 'Diserahkan ' + tgl(r.tgl_serah)) : r.rekomendasi === 'Kompeten' ? s('now', sert || 'Proses') : s(r.rekomendasi === 'Belum Kompeten' ? 'skip' : 'wait');
    return out;
  }

  /* Tabel responsif: di layar HP setiap baris tabel tampil sebagai kartu.
   * Label kolom (teks <th>) disalin ke setiap <td> sebagai data-label untuk ditampilkan oleh CSS. */
  function labelTabel(root) {
    $$('.table-wrap table', root || document).forEach(t => {
      const head = $$('thead th', t).map(th => th.textContent.trim());
      if (!head.length) return;
      $$('tbody tr', t).forEach(tr => {
        if (tr.dataset.lbl === '1') return;
        let i = 0;
        Array.from(tr.children).forEach(td => { if (!td.hasAttribute('data-label')) td.setAttribute('data-label', head[i] || ''); i += Number(td.colSpan || 1); });
        tr.dataset.lbl = '1';
      });
    });
  }
  let lblJadwal = 0;
  new MutationObserver(() => { if (lblJadwal) return; lblJadwal = requestAnimationFrame(() => { lblJadwal = 0; labelTabel(); }); })
    .observe(document.documentElement, { childList: true, subtree: true });

  window.S = { CFG, DEMO, api, store, esc, safeUrl, $, $$, tgl, rupiah, today, badge, toast, modal, loading, fileToPayload, formData, busy, copy, csv, icon, guilloche, SOP, tahapPeserta };
})();
