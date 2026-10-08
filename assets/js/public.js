/* SIPINTAR LSP UNIMED — halaman layanan publik (asesi / pemohon) */
(function () {
  const { api, esc, $, $$, tgl, rupiah, badge, toast, loading, fileToPayload, formData, busy, copy, icon, guilloche, SOP, tahapPeserta, store, DEMO, CFG } = window.S;

  const NAV = [
    { group: 'Informasi', items: [['alur', 'Alur layanan (SOP)', 'flow', '10 langkah pelayanan sertifikasi'], ['skema', 'Skema sertifikasi', 'book', 'Unit, persyaratan, dan biaya'], ['dokumen', 'Dokumen mutu', 'file', 'SOP, acuan, dan formulir']] },
    { group: 'Uji kompetensi', items: [['jadwal', 'Jadwal & pendaftaran', 'cal', 'Pilih jadwal lalu daftar online'], ['status', 'Status permohonan', 'search', 'Verifikasi, jadwal, dan riwayat'], ['plotting', 'Plotting asesor & TUK', 'grid', 'Peserta yang sudah dijadwalkan'], ['hasil', 'Hasil uji', 'check', 'Keputusan kompeten / belum'], ['sertifikat', 'Lacak sertifikat', 'award', 'Status cetak dan pengambilan']] },
    { group: 'Setelah uji', items: [['banding', 'Banding asesmen', 'scale', 'Ajukan keberatan atas keputusan'], ['surveilans', 'Surveilans', 'eye', 'Pemeliharaan kompetensi'], ['legalisir', 'Legalisir sertifikat', 'stamp', 'Pengesahan salinan sertifikat'], ['rcc', 'Perpanjangan (RCC)', 'refresh', 'Sertifikasi ulang']] },
    { group: 'Bantuan', items: [['keluhan', 'Sampaikan keluhan', 'chat', 'Ditindaklanjuti Manajemen Mutu'], ['tiket', 'Lacak tiket', 'ticket', 'Tanggapan keluhan & layanan'], ['survei', 'Survei kepuasan', 'star', 'Nilai pelayanan kami']] }
  ];
  const INFO = { beranda: ['Beranda', ''] };
  NAV.forEach(g => g.items.forEach(i => INFO[i[0]] = [i[1], i[3], g.group]));
  INFO.daftar = ['Formulir pendaftaran', 'Permohonan sertifikasi kompetensi (FR.APL.01)', 'Uji kompetensi'];
  const LEAD = {
    alur: 'Setiap permohonan melewati sepuluh langkah yang sama. Setiap langkah punya penanggung jawab dan tercatat, sehingga dapat ditelusuri kembali.',
    skema: 'Pilih skema yang sesuai dengan bidang Anda. Persyaratan dasar dan jumlah unit kompetensi tercantum di setiap skema.',
    dokumen: 'Dokumen yang menjadi dasar pelayanan sertifikasi di LSP Universitas Negeri Medan.',
    jadwal: 'Pilih jadwal yang masih dibuka, lalu isi formulir permohonan dan unggah dokumen persyaratan.',
    status: 'Pantau verifikasi persyaratan, jadwal asesmen, asesor, dan TUK Anda.',
    plotting: 'Daftar peserta yang sudah ditetapkan asesor, TUK, dan waktu asesmennya. Nama ditampilkan sebagian.',
    hasil: 'Keputusan sertifikasi disampaikan setelah asesmen dan rapat keputusan.',
    sertifikat: 'Ikuti sertifikat Anda dari pengajuan ke BNSP sampai diserahkan.',
    banding: 'Peserta yang tidak sepakat dengan keputusan asesmen berhak mengajukan banding.',
    surveilans: 'Laporkan kegiatan yang menjaga kompetensi Anda selama masa berlaku sertifikat.',
    legalisir: 'Ajukan pengesahan salinan sertifikat kompetensi yang diterbitkan melalui LSP ini.',
    rcc: 'Perpanjang sertifikat yang akan atau sudah habis masa berlakunya.',
    keluhan: 'Setiap keluhan diberi nomor tiket dan ditindaklanjuti Bagian Manajemen Mutu. Identitas pelapor dijaga.',
    tiket: 'Masukkan nomor tiket dan email untuk melihat tanggapan admin.',
    survei: 'Penilaian Anda dipakai untuk memperbaiki mutu layanan sertifikasi.',
    daftar: 'Isi data sesuai KTP. Kolom bertanda * wajib diisi.'
  };

  let PD = null; // data publik (cache)
  let LAST = null; // hasil lacak terakhir
  const root = $('#view');
  let view = root;

  /* Data publik disimpan di browser agar halaman tampil seketika; versi terbaru diambil di latar. */
  const PD_KEY = 'sipintar_pd_' + (CFG.API_URL || 'demo').slice(-24);
  const PD_LIVE = ['beranda', 'skema', 'jadwal', 'dokumen'];
  function pdRead() { try { const c = JSON.parse(localStorage.getItem(PD_KEY)); return c && c.data ? c.data : null; } catch (e) { return null; } }
  function pdWrite(d) { try { localStorage.setItem(PD_KEY, JSON.stringify({ t: Date.now(), data: d })); } catch (e) { /* abaikan */ } }
  let refreshing = false;
  function pdRefresh() {
    if (refreshing) return;
    refreshing = true;
    api('publicData').then(d => {
      const changed = JSON.stringify(d) !== JSON.stringify(PD);
      PD = d; pdWrite(d);
      const page = (location.hash.replace(/^#\/?/, '') || 'beranda').split('/')[0];
      if (changed && PD_LIVE.indexOf(page) >= 0) router(true);
    }).catch(() => { /* tetap pakai data tersimpan */ }).finally(() => { refreshing = false; });
  }
  async function pd(force) {
    if (PD && !force) return PD;
    if (!force) { const c = pdRead(); if (c) { PD = c; pdRefresh(); return PD; } }
    PD = await api('publicData'); pdWrite(PD);
    return PD;
  }

  /* ---------------- Kerangka ---------------- */
  function renderNav(active) {
    $('#nav').innerHTML = `<a href="#/beranda" class="${active === 'beranda' ? 'cur' : ''}">Beranda</a>` + NAV.map(g => {
      const cur = g.items.some(i => i[0] === active);
      return `<div class="grp ${cur ? 'cur' : ''}" data-label="${esc(g.group)}"><button type="button" aria-expanded="false">${esc(g.group)} ${icon('chev')}</button>
        <div class="drop">${g.items.map(i => `<a href="#/${i[0]}" class="${active === i[0] ? 'cur' : ''}">${icon(i[2])}<span><b>${esc(i[1])}</b><small class="muted">${esc(i[3])}</small></span></a>`).join('')}</div></div>`;
    }).join('');
  }
  function closeMenus() {
    $$('.grp.open').forEach(g => { g.classList.remove('open'); $('button', g).setAttribute('aria-expanded', 'false'); });
  }
  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('.grp > button');
    if (!b) return;
    const g = b.parentElement, was = g.classList.contains('open');
    closeMenus();
    if (!was) { g.classList.add('open'); b.setAttribute('aria-expanded', 'true'); }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.grp')) closeMenus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenus(); document.body.classList.remove('nav-open'); } });

  function footer(p) {
    $('#footer').innerHTML = `<div class="in">
      <div><div class="foot-logos">
          <img src="assets/img/logo-unimed.png" alt="Universitas Negeri Medan" onerror="this.remove()">
          <img src="assets/img/logo-lsp.png" alt="LSP Universitas Negeri Medan" onerror="this.remove()">
          <img src="assets/img/logo-bnsp.png" alt="Badan Nasional Sertifikasi Profesi" onerror="this.remove()"></div>
        <b>SIPINTAR</b>Sistem Informasi Pemantauan dan Layanan Terintegrasi<br>${esc(p.nama_lsp || 'LSP Universitas Negeri Medan')}<br>${esc(p.alamat || '')}
        <span class="foot-lisensi">${p.nomor_lisensi ? 'Berlisensi BNSP No. ' + esc(p.nomor_lisensi) : 'Berlisensi Badan Nasional Sertifikasi Profesi (BNSP)'}<br><a href="https://bnsp.go.id" target="_blank" rel="noopener">www.bnsp.go.id</a></span></div>
      <div><b>Hubungi kami</b><ul>${p.email ? `<li><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></li>` : ''}${p.telepon ? `<li>${esc(p.telepon)}</li>` : ''}${p.whatsapp ? `<li><a href="https://wa.me/${esc(p.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a></li>` : ''}${p.jam_layanan ? `<li>${esc(p.jam_layanan)}</li>` : ''}</ul></div>
      <div><b>Tautan</b><ul><li><a href="#/alur">Alur layanan (SOP ${esc(SOP.nomor)})</a></li><li><a href="#/dokumen">Dokumen mutu</a></li><li><a href="#/keluhan">Sampaikan keluhan</a></li><li><a href="admin.html">Masuk admin</a></li></ul></div></div>`;
  }

  async function router(silent) {
    const parts = (location.hash.replace(/^#\/?/, '') || 'beranda').split('/');
    const page = PAGES[parts[0]] ? parts[0] : 'beranda';
    const navKey = page === 'daftar' ? 'jadwal' : page;
    renderNav(navKey);
    closeMenus();
    document.body.classList.remove('nav-open');
    $('#menuBtn').setAttribute('aria-expanded', 'false');
    if (!silent) window.scrollTo(0, 0);
    const info = INFO[page] || INFO.beranda;
    document.title = (page === 'beranda' ? '' : info[0] + ' — ') + 'SIPINTAR LSP UNIMED';
    if (page === 'beranda') { root.innerHTML = loading(); view = root; }
    else {
      root.innerHTML = `<div class="page-head"><div class="crumb"><a href="#/beranda">Beranda</a> / ${esc(info[2] || '')}</div><h1>${esc(info[0])}</h1>${LEAD[page] ? `<p>${esc(LEAD[page])}</p>` : ''}</div><div class="page" id="pg">${loading()}</div>`;
      view = $('#pg');
    }
    try {
      const data = await pd();
      footer(data.pengaturan);
      await PAGES[page](data, parts.slice(1));
    } catch (e) {
      view.innerHTML = `<div class="notice bad"><b>Halaman gagal dimuat.</b> ${esc(e.message)}</div><button class="btn ghost" onclick="location.reload()">Muat ulang</button>`;
    }
  }

  /* ---------------- Jadwal (blok tanggal) ---------------- */
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function schedItem(j) {
    const m = String(j.tanggal || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    const status = j.bisa_daftar ? '' : badge(j.status === 'Dibuka' ? 'Ditutup' : j.status);
    return `<li>
      <div class="date">${m ? `<div class="m">${BLN[+m[2] - 1]}</div><div class="d">${+m[3]}</div><div class="y">${m[1]}</div>` : '<div class="d">?</div>'}</div>
      <div><h3>${esc(j.nama_skema)}</h3><div class="meta"><span>${tgl(j.tanggal, true).split(',')[0]}${j.waktu ? ', ' + esc(j.waktu) : ''}</span><span>${esc(j.nama_tuk || '')}</span>${j.batas_daftar && j.bisa_daftar ? `<span>Pendaftaran dibuka sampai ${tgl(j.batas_daftar)}</span>` : ''}</div></div>
      <div class="end"><a class="btn sm ghost" href="#/skema/${esc(j.id_skema)}">Persyaratan</a>${j.bisa_daftar ? `<a class="btn sm" href="#/daftar/${esc(j.id_jadwal)}">Daftar</a>` : status}</div></li>`;
  }

  /* ---------------- Persiapan berkas sebelum mendaftar ---------------- */
  const isContoh = (x) => /contoh/i.test(String(x.kategori || ''));
  /** Link dokumen per skema (fallback: dokumen umum). contoh=true → kategori "Contoh Pengisian". */
  function linkDok(D, re, idSkema, contoh) {
    const ok = x => re.test(x.nomor + ' ' + x.judul) && x.link && isContoh(x) === !!contoh;
    const d = (idSkema && D.dokumen.find(x => ok(x) && x.id_skema === idSkema)) || D.dokumen.find(x => ok(x) && !x.id_skema);
    return d ? d.link : '';
  }
  /** Contoh pengisian APL-01 & APL-02 per skema (sheet Dokumen, kategori "Contoh Pengisian");
   *  cadangan: Pengaturan link_contoh_apl01 / link_contoh_apl02. */
  function contohLink(D, n, idSkema) {
    return linkDok(D, n === 1 ? /APL.?01/i : /APL.?02/i, idSkema, true) || (D.pengaturan || {})['link_contoh_apl0' + n] || '';
  }
  function contohApl(D, idSkema) {
    if (!idSkema) return `<b>Contoh pengisian</b> APL-01 dan APL-02 tersedia per skema di menu <a href="#/dokumen">Dokumen mutu</a> (pilih skema Anda).`;
    const l = (n) => { const h = contohLink(D, n, idSkema); return h ? `<a href="${esc(h)}" target="_blank" rel="noopener">Contoh FR.APL.0${n}</a>` : `Contoh FR.APL.0${n} <span class="muted">(segera tersedia)</span>`; };
    return `<b>Contoh pengisian untuk skema ini:</b> ${l(1)} · ${l(2)}`;
  }
  function persiapanBerkas(D, idSkema) {
    const apl01 = linkDok(D, /APL.?01/i, idSkema), apl02 = linkDok(D, /APL.?02/i, idSkema) || D.pengaturan.link_template_apl02;
    const a = (href, t) => href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${t}</a>` : t;
    const info = D.pengaturan.info_verifikasi_langsung || 'Verifikasi langsung berkas asli dilakukan di Sekretariat LSP UNIMED pada jam layanan.';
    return `<div class="card" style="background:var(--amber-soft);border-color:#f3dcb1">
      <h3 style="margin-top:0">Siapkan berkas sebelum mendaftar</h3>
      <p style="margin-bottom:8px">Pendaftaran dilakukan sekali isi. Pindai (scan) berkas berikut terlebih dahulu dalam format <b>PDF, JPG, atau PNG, maksimal ${CFG.MAX_FILE_MB || 2} MB per berkas</b>:</p>
      <div class="notice" style="margin:0 0 10px;background:#fff"><b>Formulir FR.APL.01 dan FR.APL.02 berbeda untuk setiap skema.</b> Unduh formulir sesuai skema yang Anda pilih, <b>cetak dan isi dengan tulisan tangan</b> (tidak diketik), tandatangani asli, lalu pindai (scan) untuk diunggah. Formulir aslinya dibawa saat verifikasi langsung.<br>${contohApl(D, idSkema)}</div>
      <ol style="margin:0 0 10px;padding-left:20px">
        <li><b>FR.APL.01</b> Permohonan Sertifikasi <b>sesuai skema</b> — dicetak, diisi tulisan tangan, dan <b>ditandatangani</b>. ${apl01 ? 'Unduh template: ' + a(apl01, 'FR.APL.01') : 'Template per skema tersedia di menu ' + a('#/dokumen' + (idSkema ? '/' + esc(idSkema) : ''), 'Dokumen mutu') + '.'}</li>
        <li><b>FR.APL.02</b> Asesmen Mandiri <b>sesuai skema</b> — dicetak dan diisi tulisan tangan. ${apl02 ? 'Unduh template: ' + a(apl02, 'FR.APL.02') : 'Template per skema tersedia di menu ' + a('#/dokumen' + (idSkema ? '/' + esc(idSkema) : ''), 'Dokumen mutu') + '.'}</li>
        <li>KTP dan pas foto berwarna terbaru.</li>
        <li>KHS / transkrip dengan nilai minimal B pada mata kuliah yang disyaratkan skema.</li>
        <li>Surat keterangan mahasiswa aktif dari Dekan, serta bukti magang/PKLI atau sertifikat pelatihan — gabungkan dalam satu PDF.</li>
      </ol>
      <p style="margin:0"><b>Simpan berkas aslinya.</b> Setelah berkas online dinyatakan lengkap, Anda wajib datang untuk <b>verifikasi langsung</b> dengan membawa seluruh berkas asli. ${esc(info)}</p>
      <div class="mini-alur"><span>1. Daftar online</span><span>2. Pemeriksaan kelengkapan</span><span>3. Verifikasi langsung berkas asli</span><span>4. Jadwal asesmen</span></div>
    </div>`;
  }

  /* ---------------- Bukti pendaftaran ---------------- */
  function buktiRows(b) {
    return [['No. Registrasi', b.no_reg], ['Nama', b.nama], ['NIK', b.nik], ['Email', b.email], ['Skema', b.skema + (b.kode_skema ? ' (' + b.kode_skema + ')' : '')],
      ['Jadwal uji', tgl(b.tanggal, true) + (b.waktu ? ', ' + b.waktu : '')], ['TUK', b.tuk || '-'], ['Waktu daftar', tgl(b.waktu_daftar)], ['Status', b.status_verifikasi]];
  }
  function cetakBukti(b) {
    const p = (PD && PD.pengaturan) || {};
    const w = window.open('', '_blank');
    if (!w) { toast('Izinkan pop-up untuk mencetak bukti.', 'bad'); return; }
    w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Bukti pendaftaran ${esc(b.no_reg)}</title>
      <style>body{font-family:Arial,sans-serif;color:#000;margin:40px;font-size:14px}h1{font-size:20px;margin:0 0 4px}table{border-collapse:collapse;margin:18px 0;width:100%}td{border:1px solid #000;padding:8px 10px;vertical-align:top}td:first-child{width:34%}.no{font-size:26px;font-weight:bold;letter-spacing:1px;margin:14px 0}p{line-height:1.5}</style></head><body>
      <img src="${new URL(CFG.LOGO_FULL || 'assets/img/logo-lsp.png', location.href).href}" alt="LSP UNIMED" style="height:70px;margin-bottom:12px">
      <h1>Bukti Pendaftaran Uji Kompetensi</h1><div>${esc(p.nama_lsp || 'LSP Universitas Negeri Medan')}</div>
      <div class="no">${esc(b.no_reg)}</div>
      <table>${buktiRows(b).map(r => `<tr><td>${esc(r[0])}</td><td><b>${esc(r[1])}</b></td></tr>`).join('')}</table>
      <p>Simpan bukti ini dan bawa saat asesmen bersama KTP asli. Hasil verifikasi, jadwal final, asesor, dan TUK dikirim ke email di atas dan dapat dipantau di SIPINTAR menu Status permohonan.</p>
      <p>Dicetak ${tgl(new Date().toISOString().slice(0, 10))}</p><script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  }

  /* ---------------- Komponen lookup peserta ---------------- */
  function lookupForm(id, judul, tombol) {
    const last = JSON.parse(store.get('sipintar_lookup') || '{}');
    return `<div class="card no-print"><p class="muted">${esc(judul)}: masukkan nomor registrasi dan email yang Anda pakai saat mendaftar.</p>
      <form class="form" id="${id}">
        <div class="row">
          <label class="f">No. Registrasi <input name="no_reg" required placeholder="LSPU-2610-0001" value="${esc(last.no_reg || '')}" autocomplete="off"></label>
          <label class="f">Email terdaftar <input name="email" type="email" required placeholder="nama@email.com" value="${esc(last.email || '')}"></label>
        </div>
        <div><button class="btn" type="submit">${icon('search')} ${esc(tombol)}</button></div>
      </form></div><div id="${id}-out"></div>`;
  }

  function bindLookup(id, render) {
    const f = $('#' + id);
    const out = $('#' + id + '-out');
    const go = async (btn) => {
      const d = formData(f);
      out.innerHTML = loading('Mencari data…');
      try {
        const r = await api('lacak', d);
        LAST = r;
        store.set('sipintar_lookup', JSON.stringify(d));
        out.innerHTML = render(r);
      } catch (e) { out.innerHTML = `<div class="notice bad">${esc(e.message)}</div>`; }
    };
    f.addEventListener('submit', (e) => { e.preventDefault(); busy($('button[type=submit]', f), go); });
    if ($('[name=no_reg]', f).value && $('[name=email]', f).value) go();
  }

  function statusBerkas(r) {
    const kl = r.status_kelengkapan || 'Menunggu Pemeriksaan';
    const info = (PD && PD.pengaturan.info_verifikasi_langsung) || '';
    const lbl = { apl01: 'FR.APL.01', ktp: 'KTP', foto: 'Pas foto', ijazah: 'KHS / transkrip', apl02: 'FR.APL.02', pendukung: 'Surat aktif + bukti persyaratan' };
    let h = `<div style="margin-top:14px"><b>Kelengkapan berkas:</b> ${badge(kl)} <small class="muted">Terunggah: ${(r.berkas || []).map(k => lbl[k.replace(/^file_/, '')] || k).join(', ') || '-'}</small></div>`;
    const ulang = kl === 'Belum Lengkap' || r.status_verifikasi === 'Perlu Perbaikan';
    if (kl === 'Belum Lengkap') h += `<div class="notice" style="margin-top:10px"><b>Berkas belum lengkap:</b> ${esc(r.catatan_kelengkapan || '-')}</div>`;
    if (r.status_verifikasi === 'Perlu Perbaikan') h += `<div class="notice" style="margin-top:10px"><b>Perlu perbaikan:</b> ${esc(r.catatan_verifikasi || '-')}</div>`;
    if (r.status_verifikasi === 'Tidak Memenuhi Syarat') h += `<div class="notice bad" style="margin-top:10px"><b>Tidak memenuhi syarat.</b> ${esc(r.catatan_verifikasi || '')}</div>`;
    if (kl === 'Lengkap' && r.status_verifikasi === 'Menunggu Verifikasi') h += `<div class="notice info" style="margin-top:10px"><b>Berkas lengkap — lakukan verifikasi langsung.</b> Bawa seluruh berkas asli (APL-01 bertanda tangan, surat keterangan aktif, print out KHS, KTP, dan bukti persyaratan). ${esc(info)}</div>`;
    if (ulang) h += `<form class="form" id="fUlang" style="margin-top:10px;padding:14px;border:1px dashed var(--line);border-radius:10px">
        <b>Unggah ulang berkas</b><small class="muted">Pilih hanya berkas yang perlu diganti. PDF/JPG/PNG, maks. ${CFG.MAX_FILE_MB || 2} MB.</small>
        ${Object.keys(lbl).map(k => `<label class="f">${lbl[k]}<input type="file" name="file_${k}" accept=".pdf,.jpg,.jpeg,.png"></label>`).join('')}
        <div><button class="btn sm" type="submit">${icon('send')} Kirim berkas</button></div></form>`;
    return h;
  }

  function identitas(r) {
    return `<dl class="kv">
      <dt>No. Registrasi</dt><dd class="mono">${esc(r.no_reg)}</dd>
      <dt>Nama</dt><dd>${esc(r.nama)}</dd>
      <dt>NIK</dt><dd class="mono">${esc(r.nik)}</dd>
      <dt>Skema</dt><dd>${esc(r.skema)} ${r.kode_skema ? '<small class="mono">(' + esc(r.kode_skema) + ')</small>' : ''}</dd>
      <dt>Jadwal pilihan</dt><dd>${tgl(r.jadwal_tanggal, true)}</dd>
      <dt>Tanggal daftar</dt><dd>${tgl(r.waktu_daftar)}</dd></dl>`;
  }

  function timeline(r) {
    const T = tahapPeserta(r);
    const items = SOP.langkah.filter(l => T[l.no]);
    return `<ul class="timeline">${items.map(l => {
      const t = T[l.no];
      const cls = t.st === 'done' ? 'done' : t.st === 'now' ? 'now' : t.st === 'fail' ? 'fail' : '';
      return `<li class="${cls}"><span class="dot">${t.st === 'done' ? '✓' : t.st === 'fail' ? '!' : l.no}</span>
        <b>${l.no}. ${esc(l.nama)}</b><small>${esc(t.info || (t.st === 'skip' ? 'Tidak berlaku' : 'Belum sampai tahap ini'))}</small></li>`;
    }).join('')}</ul>`;
  }

  /* ---------------- Halaman ---------------- */
  const PAGES = {
    beranda(D) {
      const p = D.pengaturan, st = D.statistik;
      const next = D.jadwal.filter(j => j.bisa_daftar).slice(0, 4);
      const last = JSON.parse(store.get('sipintar_lookup') || '{}');
      root.innerHTML = `
      <section class="hero-wrap">${guilloche()}
        <div class="hero">
          <div>
            <img class="hero-logo" src="${esc(CFG.LOGO_FULL || 'assets/img/logo-lsp.png')}" alt="LSP UNIMED">
            <h1><span class="h1-lead">Lembaga Sertifikasi Profesi (LSP) Universitas Negeri Medan:</span> buktikan kompetensi Anda, raih sertifikat kompetensi BNSP!</h1>
            <p class="lead">Daftar uji kompetensi, pantau verifikasi dan jadwal asesmen, lihat hasil, dan lacak sertifikat Anda dalam satu layanan terintegrasi.</p>
            <div class="actions"><a class="btn" href="#/jadwal">${icon('cal')} Lihat jadwal & daftar</a><a class="btn ghost" href="#/skema">${icon('book')} Pilih skema</a></div>
          </div>
          <form class="track-card form" id="fTrack">
            <div><h2>Lacak permohonan</h2><p style="margin:0">Gunakan nomor registrasi dan email saat mendaftar.</p></div>
            <label class="f">Nomor registrasi<input name="no_reg" required placeholder="LSPU-2610-0001" value="${esc(last.no_reg || '')}" autocomplete="off"></label>
            <label class="f">Email<input name="email" type="email" required placeholder="nama@email.com" value="${esc(last.email || '')}"></label>
            <button class="btn dark block" type="submit">${icon('search')} Lihat status</button>
          </form>
        </div>
        <div class="rail-wrap">
          <div class="rail-title"><h2>Sepuluh langkah layanan sertifikasi</h2><a href="#/alur" style="font-size:.9rem">Baca SOP ${esc(SOP.nomor)}</a></div>
          <ol class="rail">${SOP.langkah.map(l => `<li><a href="${l.link}"><span class="node">${l.no}</span><b>${esc(l.nama.replace(' Sertifikasi', '').replace(' Pelayanan', ''))}</b><small class="muted">${esc(l.pj)}</small></a></li>`).join('')}</ol>
        </div>
      </section>
      <div class="page">
        ${p.pengumuman ? `<div class="notice">${esc(p.pengumuman)}</div>` : ''}
        <div class="figures">
          <div><b>${st.skema}</b><span>skema sertifikasi</span></div>
          <div><b>${st.tuk}</b><span>tempat uji kompetensi</span></div>
          <div><b>${st.asesor}</b><span>asesor kompetensi</span></div>
          <div><b>${Number(st.asesi).toLocaleString('id-ID')}</b><span>asesi terdaftar</span></div>
        </div>
        <div class="section-title"><h2>Jadwal uji yang dibuka</h2><a href="#/jadwal">Semua jadwal</a></div>
        ${next.length ? `<ul class="sched">${next.map(schedItem).join('')}</ul>` : '<div class="card"><p class="muted" style="margin:0">Belum ada jadwal yang dibuka. Pantau halaman ini atau email resmi LSP.</p></div>'}
        <div class="grid g2" style="margin-top:34px">
          <div class="card"><h3>Setelah uji kompetensi</h3>
            <p class="muted">Layanan untuk peserta dan pemegang sertifikat.</p>
            <div class="grid g2" style="gap:8px">
              <a class="btn ghost" href="#/hasil">${icon('check')} Hasil uji</a><a class="btn ghost" href="#/sertifikat">${icon('award')} Lacak sertifikat</a>
              <a class="btn ghost" href="#/banding">${icon('scale')} Banding</a><a class="btn ghost" href="#/legalisir">${icon('stamp')} Legalisir</a>
              <a class="btn ghost" href="#/surveilans">${icon('eye')} Surveilans</a><a class="btn ghost" href="#/rcc">${icon('refresh')} Perpanjangan</a>
            </div></div>
          <div class="card"><h3>Ada kendala pelayanan?</h3>
            <p class="muted">Sampaikan keluhan Anda. Setiap keluhan mendapat nomor tiket dan ditanggapi admin.</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="#/keluhan">${icon('chat')} Sampaikan keluhan</a><a class="btn ghost" href="#/tiket">${icon('ticket')} Lacak tiket</a></div>
            ${p.jam_layanan ? `<p class="muted" style="margin:14px 0 0">Jam layanan sekretariat: ${esc(p.jam_layanan)}</p>` : ''}</div>
        </div>
      </div>`;
      $('#fTrack').addEventListener('submit', (e) => {
        e.preventDefault();
        store.set('sipintar_lookup', JSON.stringify(formData(e.target)));
        location.hash = '#/status';
      });
    },

    alur() {
      view.innerHTML = `
      <div class="card">
        <div class="card-head"><h2>SOP ${esc(SOP.judul)}</h2><span class="badge info mono">${esc(SOP.nomor)} · Rev. ${esc(SOP.revisi)} · Berlaku ${esc(SOP.berlaku)}</span></div>
        <dl class="kv">
          <dt>Tujuan</dt><dd style="font-weight:500">${esc(SOP.tujuan)}</dd>
          <dt>Ruang lingkup</dt><dd style="font-weight:500">${esc(SOP.ruang)}</dd>
          <dt>Koordinator</dt><dd>${esc(SOP.koordinator)}</dd>
          <dt>Acuan</dt><dd style="font-weight:500"><ol style="margin:0;padding-left:18px">${SOP.acuan.map(a => `<li>${esc(a)}</li>`).join('')}</ol></dd>
        </dl>
      </div>
      <h2>Proses prosedur &amp; layanan di SIPINTAR</h2>
      <div class="steps">${SOP.langkah.map(l => `
        <div class="step"><div class="num">${l.no}</div><div>
          <h3>${esc(l.nama)}</h3>
          <ol>${l.instruksi.map(i => `<li>${esc(i)}</li>`).join('')}</ol>
          <div class="meta"><span class="badge">Keluaran: ${esc(l.media)}</span><span class="badge warn">PJ: ${esc(l.pj)}</span>
          ${l.fitur.map(f => `<span class="badge ok">${esc(f)}</span>`).join('')}</div>
        </div></div>`).join('')}
      </div>
      <div class="card" style="margin-top:18px">
        <h3>Dokumen terkait</h3><p>${esc(SOP.dokumenTerkait)}</p>
        <h3>Catatan mutu</h3><p style="margin:0">${esc(SOP.catatanMutu)}</p>
      </div>`;
    },

    skema(D, args) {
      const draw = (q) => {
        const list = D.skema.filter(s => !q || (s.nama_skema + ' ' + s.kode_skema).toLowerCase().indexOf(q) >= 0);
        $('#skList').innerHTML = list.length ? list.map(s => {
          const jd = D.jadwal.filter(j => j.id_skema === s.id_skema && j.bisa_daftar).length;
          return `<div class="skema-item" id="sk-${esc(s.id_skema)}"><div>
            ${s.kode_skema ? `<div class="code">${esc(s.kode_skema)}</div>` : ''}<h3>${esc(s.nama_skema)}</h3>
            <div class="facts"><span>${esc(s.jenis_skema || 'Skema')}</span>${s.jumlah_unit ? `<span>${esc(s.jumlah_unit)} unit kompetensi</span>` : ''}${String(s.biaya || '') !== '' ? `<span>Biaya: ${rupiah(s.biaya)}</span>` : ''}</div>
            ${s.persyaratan ? `<div style="margin-top:8px;font-weight:600;font-size:.9rem">Persyaratan skema</div><ul>${String(s.persyaratan).split(/\n+/).filter(String).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>
            <div class="act"><a class="btn sm ${jd ? '' : 'ghost'}" href="#/jadwal/${esc(s.id_skema)}">${jd ? jd + ' jadwal dibuka' : 'Lihat jadwal'}</a>
            <a class="btn sm ghost" href="#/dokumen/${esc(s.id_skema)}">${icon('file')} Formulir skema</a>
            ${s.link_dokumen ? `<a class="btn sm ghost" href="${esc(s.link_dokumen)}" target="_blank" rel="noopener">${icon('download')} Dokumen skema</a>` : ''}</div></div>`;
        }).join('') : '<div class="empty">Tidak ada skema dengan kata kunci tersebut.</div>';
      };
      view.innerHTML = `<div class="toolbar"><input id="skQ" placeholder="Cari nama atau kode skema" aria-label="Cari skema"><span class="muted">${D.skema.length} skema</span></div><div class="skema-list" id="skList"></div>`;
      $('#skQ').oninput = (e) => draw(e.target.value.toLowerCase().trim());
      draw('');
      if (args && args[0]) { const el = document.getElementById('sk-' + args[0]); if (el) { el.scrollIntoView({ block: 'start' }); el.style.background = 'var(--red-soft)'; } }
    },

    dokumen(D, args) {
      const pre = args[0] || '';
      const nmS = (id) => (D.skema.find(x => x.id_skema === id) || {}).nama_skema || id;
      view.innerHTML = `<div class="notice" style="margin-bottom:14px"><b>FR.APL.01 dan FR.APL.02 berbeda untuk setiap skema</b> — pilih skema Anda di bawah. Formulir dicetak, diisi dengan tulisan tangan (tidak diketik), ditandatangani asli, lalu dipindai untuk diunggah saat pendaftaran.<br><span id="dkC"></span></div><div class="toolbar"><label class="f" style="flex:1 1 320px">Tampilkan formulir untuk skema
        <select id="dkS"><option value="">— Dokumen umum (pilih skema) —</option>${D.skema.map(s => `<option value="${esc(s.id_skema)}" ${pre === s.id_skema ? 'selected' : ''}>${esc(s.nama_skema)}</option>`).join('')}</select></label></div><div id="dkL"></div>`;
      const draw = () => {
        const s = $('#dkS').value;
        $('#dkC').innerHTML = s ? contohApl(D, s) : '<b>Pilih skema Anda</b> untuk menampilkan FR.APL.01, FR.APL.02, dan contoh pengisiannya. Saat ini hanya dokumen umum yang ditampilkan.';
        const list = D.dokumen.filter(d => s ? (!d.id_skema || d.id_skema === s) : !d.id_skema);
        const kat = {};
        list.forEach(d => (kat[d.kategori || 'Lainnya'] = kat[d.kategori || 'Lainnya'] || []).push(d));
        $('#dkL').innerHTML = Object.keys(kat).map(k => `<div class="section-title" style="margin-top:18px"><h2>${esc(k)}</h2></div><div class="table-wrap"><table><thead><tr><th style="width:170px">Nomor</th><th>Judul</th><th style="width:30%">Berlaku untuk</th><th style="width:90px"></th></tr></thead><tbody>
          ${kat[k].map(d => `<tr><td class="mono">${esc(d.nomor)}</td><td>${esc(d.judul)}</td><td>${d.id_skema ? esc(nmS(d.id_skema)) : '<span class="muted">Semua skema</span>'}</td><td>${d.link ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="${esc(d.link)}">Unduh</a>` : '<small class="muted">Segera</small>'}</td></tr>`).join('')}
        </tbody></table></div>`).join('') || '<div class="empty">Belum ada dokumen.</div>';
      };
      $('#dkS').onchange = draw; draw();
    },

    jadwal(D, args) {
      const pre = args[0] || '';
      view.innerHTML = persiapanBerkas(D, pre) + `<div class="toolbar">
        <select id="jdS" aria-label="Filter skema"><option value="">Semua skema</option>${D.skema.map(s => `<option value="${esc(s.id_skema)}" ${pre === s.id_skema ? 'selected' : ''}>${esc(s.nama_skema)}</option>`).join('')}</select>
        <label class="check"><input type="checkbox" id="jdO" checked> Hanya yang masih dibuka</label></div>
        <ul class="sched" id="jdB"></ul>
        <p class="muted" style="margin-top:14px">Asesor dan TUK final ditetapkan setelah berkas asli Anda lolos verifikasi langsung, lalu tampil di <a href="#/plotting">Plotting asesor & TUK</a>.</p>`;
      const draw = () => {
        const s = $('#jdS').value, o = $('#jdO').checked;
        const list = D.jadwal.filter(j => (!s || j.id_skema === s) && (!o || j.bisa_daftar));
        $('#jdB').innerHTML = list.length ? list.map(schedItem).join('') : '<li style="display:block" class="empty">Belum ada jadwal yang sesuai filter.</li>';
      };
      $('#jdS').onchange = draw; $('#jdO').onchange = draw; draw();
    },

    daftar(D, args) {
      const j = D.jadwal.find(x => x.id_jadwal === args[0]);
      if (!j) { view.innerHTML = '<div class="notice bad">Jadwal tidak ditemukan.</div><a class="btn ghost" href="#/jadwal">Kembali ke jadwal</a>'; return; }
      if (!j.bisa_daftar) { view.innerHTML = '<div class="notice bad">Pendaftaran untuk jadwal ini sudah ditutup atau kuota penuh.</div><a class="btn ghost" href="#/jadwal">Pilih jadwal lain</a>'; return; }
      const sk = D.skema.find(s => s.id_skema === j.id_skema) || {};
      const apl02 = linkDok(D, /APL.?02/i, j.id_skema) || D.pengaturan.link_template_apl02;
      const syarat = String(sk.persyaratan || '').split(/\n+/).map(x => x.trim()).filter(String);
      const apl01 = linkDok(D, /APL.?01/i, j.id_skema);
      const file = (name, label, req, hint) => `<label class="f">${label} ${req ? '<span class="req">*</span>' : ''}<input type="file" name="${name}" accept=".pdf,.jpg,.jpeg,.png" ${req ? 'required' : ''}><small class="muted">${hint || 'PDF/JPG/PNG, maks. ' + (CFG.MAX_FILE_MB || 2) + ' MB'}</small></label>`;
      view.innerHTML = persiapanBerkas(D, j.id_skema) + `
      <div class="card"><div class="card-head"><div><small class="muted">Jadwal dipilih</small><h2 style="margin:0">${esc(j.nama_skema)}</h2></div><a class="btn sm ghost" href="#/jadwal">Ganti jadwal</a></div>
        <dl class="kv"><dt>Tanggal</dt><dd>${tgl(j.tanggal, true)} ${esc(j.waktu || '')}</dd><dt>TUK</dt><dd>${esc(j.nama_tuk || '')}</dd><dt>Batas pendaftaran</dt><dd>${tgl(j.batas_daftar)}</dd>
        </dl></div>
      <form class="card form" id="fDaftar" novalidate>
        <h2>Formulir Permohonan Sertifikasi (APL-01)</h2>
        <fieldset><legend>Data pribadi</legend><div class="form">
          <div class="row"><label class="f">Nama lengkap (sesuai KTP) <span class="req">*</span><input name="nama" required></label>
          <label class="f">NIK <span class="req">*</span><input name="nik" required inputmode="numeric" maxlength="16" pattern="\\d{16}" placeholder="16 digit"></label></div>
          <div class="row r3"><label class="f">Tempat lahir <span class="req">*</span><input name="tempat_lahir" required></label>
          <label class="f">Tanggal lahir <span class="req">*</span><input type="date" name="tanggal_lahir" required></label>
          <label class="f">Jenis kelamin <span class="req">*</span><select name="jenis_kelamin" required><option value="">Pilih…</option><option>Laki-laki</option><option>Perempuan</option></select></label></div>
          <label class="f">Alamat rumah <span class="req">*</span><textarea name="alamat" required style="min-height:60px"></textarea></label>
        </div></fieldset>
        <fieldset><legend>Kontak</legend><div class="row">
          <label class="f">Email aktif <span class="req">*</span><input type="email" name="email" required><small class="muted">Semua informasi resmi dikirim ke email ini.</small></label>
          <label class="f">No. HP / WhatsApp <span class="req">*</span><input name="hp" required inputmode="tel"></label></div></fieldset>
        <fieldset><legend>Pendidikan &amp; pekerjaan</legend><div class="form">
          <div class="row"><label class="f">NIM (jika mahasiswa)<input name="nim"></label>
          <label class="f">Pendidikan terakhir <span class="req">*</span><select name="pendidikan" required><option value="">Pilih…</option><option>SMA/SMK</option><option>D3</option><option>D4/S1</option><option>S2</option><option>S3</option></select></label></div>
          <div class="row"><label class="f">Program studi / instansi<input name="instansi" placeholder="mis. Pendidikan Teknik Mesin, Unimed"></label>
          <label class="f">Pekerjaan / jabatan<input name="pekerjaan" placeholder="mis. Mahasiswa"></label></div>
          <label class="f">Tujuan asesmen <span class="req">*</span><select name="tujuan_asesmen" required><option value="">Pilih…</option><option>Sertifikasi</option><option>Sertifikasi Ulang</option><option>Pengakuan Kompetensi Terkini (PKT)</option><option>Rekognisi Pembelajaran Lampau (RPL)</option><option>Lainnya</option></select></label>
        </div></fieldset>
        <fieldset><legend>Persyaratan skema ${esc(sk.kode_skema || '')}</legend><div class="form">
          ${syarat.length ? `<ul style="margin:0;padding-left:20px">${syarat.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted" style="margin:0">Persyaratan skema belum diisi oleh LSP.</p>'}
          <label class="check"><input type="checkbox" name="setuju_persyaratan"> <span>Saya memenuhi seluruh persyaratan skema di atas dan melampirkan buktinya.</span></label>
          <p class="muted" style="margin:0">Formulir khusus skema ini tersedia di <a href="#/dokumen/${esc(j.id_skema)}" target="_blank">Dokumen mutu</a>.</p>
        </div></fieldset>
        <fieldset><legend>Dokumen persyaratan</legend><div class="form">
          <div class="row">${file('file_apl01', 'Scan FR.APL.01 (tulisan tangan, ditandatangani)', true, (apl01 ? `Template: <a href="${esc(apl01)}" target="_blank" rel="noopener">FR.APL.01</a> · ` : '') + (contohLink(D, 1, j.id_skema) ? `<a href="${esc(contohLink(D, 1, j.id_skema))}" target="_blank" rel="noopener">Contoh pengisian</a> · ` : '') + `PDF/JPG, maks. ${CFG.MAX_FILE_MB || 2} MB`)}${file('file_apl02', 'Scan FR.APL.02 (tulisan tangan)', false, (apl02 ? `Template: <a href="${esc(apl02)}" target="_blank" rel="noopener">FR.APL.02</a> · ` : '') + (contohLink(D, 2, j.id_skema) ? `<a href="${esc(contohLink(D, 2, j.id_skema))}" target="_blank" rel="noopener">Contoh pengisian</a> · ` : '') + `PDF/JPG, maks. ${CFG.MAX_FILE_MB || 2} MB`)}</div>
          <p class="muted" style="margin:0">FR.APL.01 dan FR.APL.02 khusus skema ini dicetak, diisi dengan tulisan tangan (tidak diketik), ditandatangani, lalu dipindai.</p>
          <div class="row">${file('file_ktp', 'Scan KTP', true)}${file('file_foto', 'Pas foto berwarna', true, 'JPG/PNG latar merah/biru, maks. ' + (CFG.MAX_FILE_MB || 2) + ' MB')}</div>
          <div class="row">${file('file_ijazah', 'KHS / transkrip nilai', false)}${file('file_pendukung', 'Surat aktif kuliah + bukti magang/PKLI atau sertifikat pelatihan', false, 'Gabungkan dalam satu PDF, maks. ' + (CFG.MAX_FILE_MB || 2) + ' MB')}</div>
          <p class="muted" style="margin:0">Berkas asli wajib dibawa saat verifikasi langsung.</p>
        </div></fieldset>
        <label class="check"><input type="checkbox" name="setuju"> <span>Saya menyatakan data dan dokumen yang saya sampaikan benar. Saya bersedia mengikuti asesmen sesuai ketentuan LSP dan memahami bahwa data saya dijaga kerahasiaannya.</span></label>
        <div><button class="btn gold" type="submit">${icon('send')} Kirim permohonan</button></div>
        <div id="dOut"></div>
      </form>`;
      const f = $('#fDaftar');
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        busy($('button[type=submit]', f), async () => {
          const out = $('#dOut'); out.innerHTML = '';
          try {
            const bad = $$('[required]', f).find(el => el.type !== 'file' && !el.value.trim());
            if (bad) { bad.focus(); throw new Error('Lengkapi kolom yang bertanda *.'); }
            const d = formData(f);
            d.id_jadwal = j.id_jadwal;
            d.files = {};
            for (const el of $$('input[type=file]', f)) if (el.files[0]) d.files[el.name] = await fileToPayload(el.files[0]);
            const r = await api('daftar', d);
            store.set('sipintar_lookup', JSON.stringify({ no_reg: r.no_reg, email: d.email.toLowerCase() }));
            PD = null; try { localStorage.removeItem(PD_KEY); } catch (x) { /* abaikan */ }
            view.innerHTML = `<div class="card"><div class="ticket"><div class="muted">Permohonan diterima. Nomor registrasi Anda:</div>
              <div class="no mono">${esc(r.no_reg)}</div><button class="btn sm ghost" id="cp">Salin nomor</button></div>
              <dl class="kv" style="margin:18px 0">${buktiRows(r).slice(1).map(x => `<dt>${esc(x[0])}</dt><dd>${esc(x[1])}</dd>`).join('')}</dl>
              <div class="notice ok">${r.email_terkirim ? 'Bukti pendaftaran juga sudah dikirim ke <b>' + esc(r.email) + '</b>.' : 'Simpan nomor registrasi ini.'} <br><b>Langkah berikutnya:</b> Bagian Administrasi memeriksa kelengkapan berkas Anda. Bila lengkap, Anda akan diminta datang untuk <b>verifikasi langsung dengan membawa berkas asli</b>. Pemberitahuannya dikirim ke email dan tampil di Status permohonan.</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="pb">${icon('print')} Cetak / simpan PDF bukti</button><a class="btn ghost" href="#/status">${icon('search')} Pantau status</a></div></div>`;
            $('#cp').onclick = () => copy(r.no_reg);
            $('#pb').onclick = () => cetakBukti(r);
          } catch (err) { out.innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; }
        });
      });
    },

    status() {
      view.addEventListener('submit', (e) => {
        const f = e.target.closest('#fUlang'); if (!f) return;
        e.preventDefault();
        busy($('button[type=submit]', f), async () => {
          try {
            const files = {};
            for (const el of $$('input[type=file]', f)) if (el.files[0]) files[el.name] = await fileToPayload(el.files[0]);
            if (!Object.keys(files).length) throw new Error('Pilih minimal satu berkas.');
            await api('unggahUlang', { no_reg: LAST.no_reg, email: LAST.email, files });
            toast('Berkas terkirim. Menunggu pemeriksaan ulang.', 'ok');
            $('#lkS button[type=submit]').click();
          } catch (err) { toast(err.message, 'bad'); }
        });
      });
      view.innerHTML = lookupForm('lkS', 'Cek status pendaftaran', 'Cek status');
      view.addEventListener('click', (e) => { if (e.target.closest('[data-bukti]') && LAST) cetakBukti({ no_reg: LAST.no_reg, nama: LAST.nama, nik: LAST.nik, email: LAST.email, skema: LAST.skema, kode_skema: LAST.kode_skema, tanggal: LAST.jadwal_tanggal, waktu: LAST.jadwal_waktu, tuk: LAST.tuk, waktu_daftar: LAST.waktu_daftar, status_verifikasi: LAST.status_verifikasi }); });
      bindLookup('lkS', r => `
        <div class="grid g2">
          <div class="card"><div class="card-head"><h3>Data permohonan</h3><button class="btn sm ghost" data-bukti>${icon('print')} Cetak bukti</button></div>${identitas(r)}
            ${statusBerkas(r)}
            ${r.status_verifikasi === 'Tidak Memenuhi Syarat' ? `<div class="notice bad" style="margin-top:14px"><b>Tidak memenuhi syarat.</b> ${esc(r.catatan_verifikasi || '')}</div>` : ''}
            ${r.status_jadwal === 'Terjadwal' ? `<div class="notice info" style="margin-top:14px"><b>Jadwal asesmen:</b> ${tgl(r.tanggal_asesmen, true)} ${esc(r.waktu_asesmen || '')}<br>TUK: ${esc(r.tuk)}${r.tuk_alamat ? ' — ' + esc(r.tuk_alamat) : ''}<br>Asesor: ${esc(r.asesor)}</div>` : ''}
          </div>
          <div class="card"><h3>Tahapan layanan (SOP)</h3>${timeline(r)}</div>
        </div>
        ${r.riwayat && r.riwayat.length ? `<div class="card"><h3>Rekaman pelayanan</h3><div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Langkah</th><th>Aktivitas</th></tr></thead><tbody>
          ${r.riwayat.map(l => `<tr><td>${tgl(l.waktu)}</td><td>${esc(l.langkah_sop)}</td><td>${esc(l.aksi)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`);
    },

    plotting: async () => {
      const list = await api('plotting');
      const groups = {};
      list.forEach(r => (groups[r.id_jadwal] = groups[r.id_jadwal] || { label: r.jadwal_label, rows: [] }).rows.push(r));
      const keys = Object.keys(groups);
      view.innerHTML = `<div class="notice info">Daftar peserta yang telah ditetapkan asesor, TUK, dan waktu asesmen (Langkah 4 SOP). Nama ditampilkan sebagian untuk menjaga kerahasiaan data peserta.</div>
        <div class="toolbar"><select id="plJ"><option value="">Semua jadwal</option>${keys.map(k => `<option value="${esc(k)}">${esc(groups[k].label)}</option>`).join('')}</select>
        <input id="plQ" placeholder="Cari No. Registrasi…"></div>
        <div class="table-wrap"><table><thead><tr><th>No. Registrasi</th><th>Nama</th><th>Skema</th><th>Tanggal &amp; waktu</th><th>TUK</th><th>Asesor</th></tr></thead><tbody id="plB"></tbody></table></div>`;
      const draw = () => {
        const j = $('#plJ').value, q = $('#plQ').value.trim().toUpperCase();
        const rows = list.filter(r => (!j || r.id_jadwal === j) && (!q || r.no_reg.toUpperCase().indexOf(q) >= 0));
        $('#plB').innerHTML = rows.length ? rows.map(r => `<tr><td class="mono">${esc(r.no_reg)}</td><td>${esc(r.nama)}</td><td>${esc(r.skema)}</td><td>${tgl(r.tanggal, true)}<br><small class="muted">${esc(r.waktu || '')}</small></td><td>${esc(r.tuk)}</td><td>${esc(r.asesor)}</td></tr>`).join('')
          : '<tr><td colspan="6" class="empty">Belum ada plotting jadwal.</td></tr>';
      };
      $('#plJ').onchange = draw; $('#plQ').oninput = draw; draw();
    },

    hasil() {
      view.innerHTML = lookupForm('lkH', 'Hasil uji kompetensi', 'Lihat hasil');
      bindLookup('lkH', r => {
        let box;
        if (r.rekomendasi === 'Kompeten') box = `<div class="result-big ok">${icon('award')}<div><div class="big">KOMPETEN</div>Diputuskan ${tgl(r.tgl_hasil)}. Sertifikat diproses ke BNSP — pantau di <a href="#/sertifikat">Tracer Sertifikat</a>.</div></div>`;
        else if (r.rekomendasi === 'Belum Kompeten') box = `<div class="result-big bad">${icon('scale')}<div><div class="big">BELUM KOMPETEN</div>Diputuskan ${tgl(r.tgl_hasil)}.</div></div>`;
        else box = `<div class="result-big wait">${icon('cal')}<div><div class="big">Belum ada hasil</div>Hasil disampaikan setelah asesmen dan rapat keputusan sertifikasi.</div></div>`;
        return `<div class="card"><h3>${esc(r.nama)} · <span class="mono">${esc(r.no_reg)}</span></h3><p class="muted">${esc(r.skema)}</p>${box}
          ${r.catatan_hasil ? `<p style="margin-top:12px"><b>Catatan:</b> ${esc(r.catatan_hasil)}</p>` : ''}
          ${r.link_surat_hasil ? `<p style="margin-top:12px"><a class="btn" target="_blank" rel="noopener" href="${esc(r.link_surat_hasil)}">${icon('download')} Unduh surat pemberitahuan hasil</a></p>` : ''}
          ${r.rekomendasi ? `<div class="notice info" style="margin-top:16px"><b>Hak banding &amp; keluhan.</b> Jika Anda tidak sepakat dengan keputusan asesmen, Anda berhak mengajukan <a href="#/banding">banding asesmen</a>. Keluhan atas pelayanan dapat disampaikan melalui <a href="#/keluhan">formulir keluhan</a>.</div>
          <a class="btn gold" href="#/survei">${icon('star')} Isi survei kepuasan</a>` : ''}</div>`;
      });
    },

    sertifikat(D) {
      view.innerHTML = lookupForm('lkC', 'Tracer & pengambilan sertifikat fisik', 'Lacak sertifikat');
      const tahap = ['Diajukan ke BNSP', 'Siap Diambil', 'Sudah Diserahkan'];
      bindLookup('lkC', r => {
        if (r.rekomendasi !== 'Kompeten') return `<div class="card"><div class="result-big wait"><div><div class="big">Belum ada sertifikat</div>Sertifikat hanya diterbitkan untuk peserta yang dinyatakan KOMPETEN. Status hasil Anda: ${badge(r.rekomendasi || 'Belum ada hasil')}</div></div></div>`;
        const pos = tahap.indexOf(r.status_sertifikat);
        return `<div class="card"><h3>${esc(r.nama)} · <span class="mono">${esc(r.no_reg)}</span></h3><p class="muted">${esc(r.skema)}</p>
          <ul class="timeline">${tahap.map((t, i) => `<li class="${i < pos || r.status_sertifikat === 'Sudah Diserahkan' ? 'done' : i === pos ? 'now' : ''}"><span class="dot">${i < pos || (i === pos && i === 2) ? '✓' : i + 1}</span><b>${esc(t)}</b>
            <small>${i === 0 ? 'Pengajuan blanko/penerbitan sertifikat ke BNSP' : i === 1 ? 'Sertifikat tersedia di Sekretariat LSP' + (r.no_sertifikat ? ' · No. ' + esc(r.no_sertifikat) : '') : r.tgl_serah ? 'Diserahkan ' + tgl(r.tgl_serah) : 'Tanda terima didokumentasikan'}</small></li>`).join('')}</ul>
          ${r.status_sertifikat === 'Siap Diambil' ? `<div class="notice ok"><b>Sertifikat siap diambil.</b> ${esc(D.pengaturan.info_pengambilan_sertifikat || '')}${D.pengaturan.jam_layanan ? '<br>Jam layanan: ' + esc(D.pengaturan.jam_layanan) : ''}</div>` : ''}</div>`;
      });
    },

    banding(D) { layananPage(D, 'banding'); },
    surveilans(D) { layananPage(D, 'surveilans'); },
    legalisir(D) { layananPage(D, 'legalisir'); },
    rcc(D) { layananPage(D, 'rcc'); },

    keluhan() {
      const last = JSON.parse(store.get('sipintar_lookup') || '{}');
      view.innerHTML = `<div class="notice info">Keluhan dicatat, diberi nomor tiket, dan ditindaklanjuti oleh Bagian Manajemen Mutu sesuai prosedur penanganan keluhan (Langkah 9 SOP). Identitas pelapor dijaga kerahasiaannya.</div>
      <form class="card form" id="fK">
        <h2>Formulir keluhan pelayanan</h2>
        <div class="row"><label class="f">Nama <span class="req">*</span><input name="nama" required></label><label class="f">Email <span class="req">*</span><input type="email" name="email" required value="${esc(last.email || '')}"></label></div>
        <div class="row"><label class="f">No. HP<input name="hp"></label><label class="f">No. Registrasi (jika ada)<input name="no_reg" value="${esc(last.no_reg || '')}"></label></div>
        <label class="f">Kategori <span class="req">*</span><select name="kategori" required><option value="">Pilih…</option><option>Informasi & pendaftaran</option><option>Administrasi & verifikasi</option><option>Jadwal & TUK</option><option>Pelaksanaan asesmen / asesor</option><option>Hasil & sertifikat</option><option>Sikap admin</option><option>Lainnya</option></select></label>
        <label class="f">Uraian keluhan <span class="req">*</span><textarea name="isi" required placeholder="Ceritakan kejadian, waktu, dan harapan penyelesaian"></textarea></label>
        <div><button class="btn" type="submit">${icon('send')} Kirim keluhan</button></div><div id="kOut"></div>
      </form>`;
      const f = $('#fK');
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        busy($('button[type=submit]', f), async () => {
          try {
            const d = formData(f);
            const r = await api('keluhan', d);
            tiketSukses(r.no_tiket, d.email, 'Keluhan Anda telah diterima dan dicatat.');
          } catch (err) { $('#kOut').innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; }
        });
      });
    },

    tiket(D, args) {
      view.innerHTML = `<form class="card form" id="fT"><h2>Lacak tiket keluhan / layanan</h2>
        <div class="row"><label class="f">Nomor tiket<input name="no" required placeholder="KLH-2610-001 / LGL-… / RCC-…" value="${esc(args[0] || '')}"></label><label class="f">Email<input type="email" name="email" required value="${esc(args[1] ? decodeURIComponent(args[1]) : '')}"></label></div>
        <div><button class="btn" type="submit">${icon('search')} Lacak</button></div></form><div id="tOut"></div>`;
      const f = $('#fT');
      const go = async () => {
        try {
          const r = await api('cekTiket', formData(f));
          $('#tOut').innerHTML = `<div class="card"><div class="card-head"><h3 class="mono">${esc(r.no)}</h3>${badge(r.status)}</div>
            <dl class="kv"><dt>Jenis</dt><dd>${esc(r.jenis)}</dd><dt>Diajukan</dt><dd>${tgl(r.waktu)}</dd><dt>Uraian</dt><dd style="font-weight:500;white-space:pre-line">${esc(r.isi)}</dd>
            <dt>Tanggapan admin</dt><dd style="white-space:pre-line">${esc(r.tanggapan || 'Belum ada tanggapan.')}</dd>${r.selesai ? `<dt>Selesai</dt><dd>${tgl(r.selesai)}</dd>` : ''}</dl></div>`;
        } catch (err) { $('#tOut').innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; }
      };
      f.addEventListener('submit', (e) => { e.preventDefault(); busy($('button[type=submit]', f), go); });
      if (args[0] && args[1]) go();
    },

    survei() {
      const last = JSON.parse(store.get('sipintar_lookup') || '{}');
      const q = [['skor_informasi', 'Kejelasan informasi skema, biaya, dan jadwal'], ['skor_administrasi', 'Kemudahan pendaftaran & administrasi'], ['skor_asesmen', 'Pelaksanaan asesmen (adil, objektif, tepat waktu)'], ['skor_petugas', 'Sikap dan responsivitas admin'], ['skor_keseluruhan', 'Kepuasan keseluruhan']];
      view.innerHTML = `<form class="card form" id="fS"><h2>Survei kepuasan pemohon sertifikasi</h2>
        <p class="muted">Skala 1 (sangat tidak puas) – 5 (sangat puas). Hasil survei digunakan untuk perbaikan mutu layanan.</p>
        ${q.map(x => `<div><div style="font-weight:700;margin-bottom:6px">${esc(x[1])}</div><div class="rating">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="${x[0]}" value="${n}"><span>${n}</span></label>`).join('')}</div></div>`).join('')}
        <label class="f">No. Registrasi (opsional)<input name="no_reg" value="${esc(last.no_reg || '')}"></label>
        <label class="f">Saran perbaikan<textarea name="saran"></textarea></label>
        <div><button class="btn" type="submit">${icon('send')} Kirim survei</button></div><div id="sOut"></div></form>`;
      const f = $('#fS');
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        busy($('button[type=submit]', f), async () => {
          try { await api('survei', formData(f)); view.innerHTML = `<div class="card"><div class="result-big ok">${icon('star')}<div><div class="big">Terima kasih!</div>Penilaian Anda membantu kami meningkatkan mutu layanan sertifikasi.</div></div></div>`; }
          catch (err) { $('#sOut').innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; }
        });
      });
    }
  };

  /* ---------------- Layanan pasca-uji ---------------- */
  const LAYANAN = {
    banding: {
      jenis: 'Banding Asesmen', intro: 'Banding diajukan oleh peserta yang tidak sepakat dengan keputusan asesmen. Banding diperiksa oleh tim yang tidak terlibat dalam asesmen yang dibanding, dan keputusannya disampaikan secara tertulis.',
      extra: [], noReg: true, ket: 'Alasan banding', ketReq: true, file: 'Bukti pendukung (opsional)'
    },
    surveilans: {
      jenis: 'Surveilans', intro: 'Surveilans dilakukan untuk memastikan pemegang sertifikat tetap memelihara kompetensinya selama masa berlaku sertifikat.',
      extra: [['pekerjaan_saat_ini', 'Pekerjaan / jabatan saat ini', 'text'], ['instansi_saat_ini', 'Instansi / tempat kerja', 'text'], ['relevan', 'Apakah pekerjaan saat ini sesuai dengan skema sertifikat?', 'select:Ya, sesuai|Sebagian|Tidak sesuai']],
      noSert: true, ket: 'Uraian kegiatan yang memelihara kompetensi', file: 'Bukti kegiatan / portofolio (opsional)'
    },
    legalisir: {
      jenis: 'Legalisir Sertifikat', intro: 'Pengajuan legalisir fotokopi/salinan sertifikat kompetensi yang diterbitkan melalui LSP ini.',
      extra: [['jumlah_lembar', 'Jumlah lembar', 'number'], ['keperluan', 'Keperluan legalisir', 'text']],
      noSert: true, ket: 'Catatan tambahan', file: 'Scan sertifikat (wajib)', fileReq: true
    },
    rcc: {
      jenis: 'Perpanjangan Sertifikat (RCC)', intro: 'Recertification (RCC) untuk memperpanjang sertifikat kompetensi yang akan atau telah habis masa berlakunya, melalui pembuktian kompetensi terkini.',
      extra: [['masa_berlaku', 'Masa berlaku sertifikat lama berakhir', 'date'], ['pekerjaan_saat_ini', 'Pekerjaan / jabatan saat ini', 'text']],
      noSert: true, ket: 'Ringkasan bukti kompetensi terkini', file: 'Sertifikat lama + portofolio (satu PDF)', fileReq: true
    }
  };

  function layananPage(D, key) {
    const L = LAYANAN[key];
    const last = JSON.parse(store.get('sipintar_lookup') || '{}');
    const field = (x) => {
      const [name, label, type] = x;
      if (type.indexOf('select:') === 0) return `<label class="f">${esc(label)}<select name="x_${name}"><option value="">Pilih…</option>${type.slice(7).split('|').map(o => `<option>${esc(o)}</option>`).join('')}</select></label>`;
      return `<label class="f">${esc(label)}<input type="${type}" name="x_${name}"></label>`;
    };
    view.innerHTML = `<div class="notice info">${esc(L.intro)}</div>
      <form class="card form" id="fL"><h2>Formulir ${esc(L.jenis)}</h2>
        <div class="row"><label class="f">Nama lengkap <span class="req">*</span><input name="nama" required></label><label class="f">Email <span class="req">*</span><input type="email" name="email" required value="${esc(last.email || '')}"></label></div>
        <div class="row"><label class="f">No. HP / WhatsApp <span class="req">*</span><input name="hp" required></label>
          ${L.noReg ? `<label class="f">No. Registrasi uji <span class="req">*</span><input name="no_reg" required value="${esc(last.no_reg || '')}"></label>` : `<label class="f">No. sertifikat <span class="req">*</span><input name="no_sertifikat" required></label>`}</div>
        <label class="f">Skema sertifikasi<select name="skema"><option value="">Pilih…</option>${D.skema.map(s => `<option>${esc(s.nama_skema)}</option>`).join('')}</select></label>
        ${L.extra.length ? `<div class="row">${L.extra.map(field).join('')}</div>` : ''}
        <label class="f">${esc(L.ket)} ${L.ketReq ? '<span class="req">*</span>' : ''}<textarea name="keterangan" ${L.ketReq ? 'required' : ''}></textarea></label>
        <label class="f">${esc(L.file)}<input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png"><small class="muted">PDF/JPG/PNG, maks. ${CFG.MAX_FILE_MB || 2} MB</small></label>
        <div><button class="btn" type="submit">${icon('send')} Ajukan</button></div><div id="lOut"></div>
      </form>`;
    const f = $('#fL');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      busy($('button[type=submit]', f), async () => {
        try {
          const raw = formData(f);
          const d = { jenis: L.jenis };
          const extra = [];
          Object.keys(raw).forEach(k => {
            if (k.indexOf('x_') === 0) { if (raw[k]) extra.push(L.extra.find(x => 'x_' + x[0] === k)[1] + ': ' + raw[k]); }
            else d[k] = raw[k];
          });
          if (L.ketReq && !d.keterangan) throw new Error(L.ket + ' wajib diisi.');
          d.keterangan = extra.concat(d.keterangan ? [d.keterangan] : []).join('\n');
          const fl = $('input[type=file]', f).files[0];
          if (L.fileReq && !fl) throw new Error(L.file.replace(' (wajib)', '') + ' wajib diunggah.');
          d.file = await fileToPayload(fl);
          const r = await api('layanan', d);
          tiketSukses(r.no_layanan, d.email, 'Permohonan ' + L.jenis + ' telah diterima.');
        } catch (err) { $('#lOut').innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; }
      });
    });
  }

  function tiketSukses(no, email, msg) {
    view.innerHTML = `<div class="card"><div class="ticket"><div class="muted">${esc(msg)} Nomor tiket Anda:</div><div class="no mono">${esc(no)}</div><button class="btn sm ghost" id="cp">Salin nomor</button></div>
      <p style="margin-top:16px">Pantau tanggapan admin melalui menu Lacak Tiket menggunakan nomor tiket dan email Anda.</p>
      <a class="btn" href="#/tiket/${encodeURIComponent(no)}/${encodeURIComponent(email)}">${icon('ticket')} Lacak tiket</a></div>`;
    $('#cp').onclick = () => copy(no);
  }

  /* ---------------- Mulai ---------------- */
  $('#menuBtn').innerHTML = icon('menu');
  $('#menuBtn').onclick = () => { const o = document.body.classList.toggle('nav-open'); $('#menuBtn').setAttribute('aria-expanded', String(o)); $('#menuBtn').innerHTML = icon(o ? 'x' : 'menu'); };
  if (CFG.LOGO_URL) { $('#logo').src = CFG.LOGO_URL; }
  if (DEMO) $('#demoBar').hidden = false;
  window.addEventListener('hashchange', () => { $('#menuBtn').innerHTML = icon('menu'); router(); });
  router();
})();
