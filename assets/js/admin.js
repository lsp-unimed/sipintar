/* SIPINTAR LSP UNIMED — panel admin (Sekretariat, Bagian Administrasi, Bagian Sertifikasi, Manajemen Mutu) */
(function () {
  const { api, esc, $, $$, tgl, badge, toast, modal, loading, formData, busy, csv, icon, SOP, tahapPeserta, store, DEMO, CFG } = window.S;
  const app = $('#app');
  let USER = null;
  let REF = { Skema: [], TUK: [], Asesor: [], Jadwal: [] };
  const byId = (arr, k) => { const m = {}; arr.forEach(r => m[r[k]] = r); return m; };
  const nmSkema = (id) => (REF.Skema.find(s => s.id_skema === id) || {}).nama_skema || id || '-';
  const nmTuk = (id) => (REF.TUK.find(s => s.id_tuk === id) || {}).nama_tuk || id || '-';
  const nmAsesor = (id) => (REF.Asesor.find(s => s.id_asesor === id) || {}).nama_asesor || id || '-';
  const jadwalLabel = (id) => { const j = REF.Jadwal.find(x => x.id_jadwal === id); return j ? nmSkema(j.id_skema) + ' — ' + tgl(j.tanggal) : id || '-'; };
  const PJ = {}; SOP.langkah.forEach(l => PJ[l.no] = l.pj);
  const BERKAS = [['file_apl01', 'FR.APL.01 bertanda tangan'], ['file_ktp', 'KTP'], ['file_foto', 'Pas foto'], ['file_ijazah', 'KHS / transkrip'], ['file_apl02', 'FR.APL.02'], ['file_pendukung', 'Surat aktif + bukti persyaratan']];
  const syaratSkema = (id) => String((REF.Skema.find(x => x.id_skema === id) || {}).persyaratan || '').split(/\n+/).map(x => x.trim()).filter(String);
  const kl = (r) => r.status_kelengkapan || 'Menunggu Pemeriksaan';
  /** formData + daftar centang (data-list) + verifikasi_langsung YA/TIDAK */
  function nilaiForm(f) {
    const v = formData(f);
    const lists = {};
    $$('input[data-list]', f).forEach(c => { (lists[c.dataset.list] = lists[c.dataset.list] || []); if (c.checked) lists[c.dataset.list].push(c.value); });
    Object.keys(lists).forEach(k => v[k] = lists[k].join(','));
    if (typeof v.verifikasi_langsung === 'boolean') v.verifikasi_langsung = v.verifikasi_langsung ? 'YA' : 'TIDAK';
    return v;
  }

  /* ---------------- Login ---------------- */
  function loginView(msg) {
    app.innerHTML = `<div class="login-wrap">
      <div class="login-art">${S.guilloche()}<h1>Panel admin LSP Universitas Negeri Medan</h1><p>SIPINTAR — Sistem Informasi Pemantauan dan Layanan Terintegrasi. Verifikasi, penjadwalan, hasil, sertifikat, dan rekaman pelayanan sesuai SOP ${esc(SOP.nomor)}.</p></div>
      <div class="login-side"><form class="login-card form" id="fLogin">
      <img class="login-logo" src="${esc(CFG.LOGO_FULL || 'assets/img/logo-lsp.png')}" alt="LSP UNIMED">
      <div class="brand"><div><b>SIPINTAR</b><span>Masuk admin</span></div></div>
      ${msg ? `<div class="notice bad">${esc(msg)}</div>` : ''}
      ${DEMO ? '<div class="notice">Mode demo: username <b>admin</b>, password <b>demo12345</b>.</div>' : ''}
      <label class="f">Username<input name="username" autocomplete="username" required></label>
      <label class="f">Password<input name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn block" type="submit">${icon('lock')} Masuk</button>
      <a href="index.html" class="muted" style="font-size:.88rem">Kembali ke layanan publik</a>
      <div id="lOut"></div></form></div></div>`;
    const f = $('#fLogin');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      busy($('button', f), async () => {
        try {
          const r = await api('login', formData(f));
          store.set('sipintar_token', r.token);
          store.set('sipintar_user', JSON.stringify(r.user));
          USER = r.user;
          await boot();
        } catch (err) { $('#lOut').innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; }
      });
    });
  }

  /* ---------------- Kerangka ---------------- */
  const NAV = [
    { group: null, items: [['ringkasan', 'Ringkasan', 'home']] },
    { group: 'Alur Sertifikasi', items: [['pendaftar', 'Pendaftar & Tahapan', 'users'], ['plotting', 'Plotting Massal', 'grid']] },
    { group: 'Layanan & Mutu', items: [['keluhan', 'Keluhan (L9)', 'chat'], ['layanan', 'Layanan Pasca-Uji', 'stamp'], ['survei', 'Survei Kepuasan', 'star'], ['rekaman', 'Rekaman & Log (L10)', 'log']] },
    { group: 'Data Master', items: [['Skema', 'Skema', 'book'], ['Jadwal', 'Jadwal', 'cal'], ['TUK', 'TUK', 'pin'], ['Asesor', 'Asesor', 'user'], ['Dokumen', 'Dokumen Mutu', 'file'], ['Pengaturan', 'Pengaturan', 'gear']] },
    { group: 'Akun', items: [['pengguna', 'Pengguna', 'shield'], ['akun', 'Ganti Password', 'lock']] }
  ];
  const TITLES = {}; NAV.forEach(g => g.items.forEach(i => TITLES[i[0]] = i[1]));

  function shell() {
    app.innerHTML = `
      <aside class="sidebar"><div class="brand"><img src="${esc(CFG.LOGO_URL || 'assets/img/favicon-192.png')}" alt="Logo LSP UNIMED"><div><b>SIPINTAR</b><span>Panel admin</span></div></div>
        <nav class="nav" id="nav"></nav>
        <div class="side-foot"><b>${esc(USER.nama)}</b><br>${esc(USER.peran)}<br><a href="#" id="logout">Keluar</a> · <a href="index.html" target="_blank">Situs publik</a></div></aside>
      <div class="scrim" id="scrim"></div>
      <div class="main"><header class="topbar"><button class="menu-btn" id="menuBtn" aria-label="Menu">${icon('menu')}</button><h1 id="pageTitle"></h1><div class="spacer"></div>${DEMO ? '<span class="demo-flag">MODE DEMO</span>' : ''}</header>
        <main class="view" id="view"></main></div>`;
    $('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
    $('#scrim').onclick = () => document.body.classList.remove('nav-open');
    $('#logout').onclick = async (e) => { e.preventDefault(); try { await api('logout'); } catch (x) { /* abaikan */ } store.del('sipintar_token'); store.del('sipintar_user'); location.hash = ''; loginView(); };
  }

  async function loadRef() {
    try { REF = await api('refData'); return; } catch (e) { if (!/tidak dikenal/i.test(e.message)) throw e; }
    const [a, b, c, d] = await Promise.all(['Skema', 'TUK', 'Asesor', 'Jadwal'].map(s => api('listSheet', { sheet: s })));
    REF = { Skema: a, TUK: b, Asesor: c, Jadwal: d };
  }

  async function boot() {
    shell();
    try { await loadRef(); } catch (e) { if (/Sesi/.test(e.message)) return loginView(e.message); toast(e.message, 'bad'); }
    window.onhashchange = route;
    route();
  }

  async function route() {
    const parts = (location.hash.replace(/^#\/?/, '') || 'ringkasan').split('/');
    const page = parts[0];
    $('#nav').innerHTML = NAV.map(g => (g.group ? `<div class="nav-group">${esc(g.group)}</div>` : '') + g.items.map(i => `<a href="#/${i[0]}" class="${page === i[0] ? 'active' : ''}">${icon(i[2])}<span>${esc(i[1])}</span></a>`).join('')).join('');
    $('#pageTitle').textContent = TITLES[page] || 'Ringkasan';
    document.body.classList.remove('nav-open');
    const v = $('#view');
    v.innerHTML = loading();
    try {
      if (MASTER[page]) await masterPage(v, page);
      else await (PAGES[page] || PAGES.ringkasan)(v, parts.slice(1));
    } catch (e) {
      if (/Sesi berakhir/.test(e.message)) return loginView(e.message);
      v.innerHTML = `<div class="notice bad">${esc(e.message)}</div>`;
    }
  }

  /* ---------------- Halaman ---------------- */
  const PAGES = {
    async ringkasan(v) {
      const s = await api('summary');
      const tile = (k, n, tab) => `<div class="stat clickable" onclick="location.hash='#/pendaftar/${tab}'"><div class="k">${esc(k)}</div><div class="v">${n}</div></div>`;
      v.innerHTML = `
        <div class="welcome"><div><h2>Selamat datang, ${esc(USER.nama)}</h2><p>${esc(USER.peran)}, bekerja mengikuti SOP ${esc(SOP.nomor)}</p></div><a class="btn sm ghost" href="index.html" target="_blank">Buka situs publik</a></div>
        <div class="grid g4" style="margin-bottom:16px">
          ${tile('Total pendaftar', s.total, 'semua')}${tile('Cek kelengkapan (L2)', s.menunggu_kelengkapan || 0, 'kelengkapan')}${tile('Verifikasi langsung (L3)', s.menunggu_verifikasi, 'verifikasi')}
          ${tile('Siap dijadwalkan (L4)', s.siap_dijadwalkan, 'jadwal')}${tile('Terjadwal / asesmen (L5–6)', s.terjadwal, 'asesmen')}
          ${tile('Kompeten (L7)', s.kompeten, 'hasil')}${tile('Sertifikat diproses (L8)', s.sertifikat_proses, 'sertifikat')}
          <div class="stat clickable" onclick="location.hash='#/keluhan'"><div class="k">Keluhan terbuka (L9)</div><div class="v">${s.keluhan_terbuka}</div></div>
          <div class="stat clickable" onclick="location.hash='#/survei'"><div class="k">Kepuasan (${s.survei_n} resp.)</div><div class="v">${s.survei_n ? s.survei_rata + '<small style="font-size:1rem">/5</small>' : '-'}</div></div>
        </div>
        ${s.perlu_perbaikan ? `<div class="notice">${s.perlu_perbaikan} pendaftar berstatus <b>Perlu Perbaikan</b> — pantau tindak lanjut dokumen.</div>` : ''}
        ${s.layanan_terbuka ? `<div class="notice info">${s.layanan_terbuka} permohonan layanan pasca-uji (banding/surveilans/legalisir/RCC) belum selesai. <a href="#/layanan">Buka</a></div>` : ''}
        <div class="card"><div class="card-head"><h3>Aktivitas terbaru (rekaman pelayanan)</h3><a class="btn sm ghost" href="#/rekaman">Semua rekaman</a></div>
          ${logTable(s.logs)}</div>`;
    },

    async pendaftar(v, args) {
      const all = await api('listPendaftar');
      const TABS = {
        semua: ['Semua', () => true],
        kelengkapan: ['L2 Kelengkapan', r => kl(r) !== 'Lengkap' && r.status_verifikasi !== 'Tidak Memenuhi Syarat'],
        verifikasi: ['L3 Verifikasi langsung', r => kl(r) === 'Lengkap' && (r.status_verifikasi === 'Menunggu Verifikasi' || r.status_verifikasi === 'Perlu Perbaikan')],
        jadwal: ['L4 Penjadwalan', r => r.status_verifikasi === 'Memenuhi Syarat' && r.status_jadwal !== 'Terjadwal'],
        asesmen: ['L5–6 Asesmen', r => r.status_jadwal === 'Terjadwal' && !r.rekomendasi],
        hasil: ['L7 Hasil', r => !!r.rekomendasi],
        sertifikat: ['L8 Sertifikat', r => r.rekomendasi === 'Kompeten' && r.status_sertifikat !== 'Sudah Diserahkan'],
        selesai: ['Selesai', r => r.status_sertifikat === 'Sudah Diserahkan' || r.rekomendasi === 'Belum Kompeten' || r.status_verifikasi === 'Tidak Memenuhi Syarat']
      };
      let tab = TABS[args[0]] ? args[0] : 'semua';
      v.innerHTML = `<div class="tabs" id="tabs"></div>
        <div class="toolbar"><input id="q" placeholder="Cari nama, No. Reg, NIK, email…"><select id="fj"><option value="">Semua jadwal</option>${REF.Jadwal.map(j => `<option value="${esc(j.id_jadwal)}">${esc(jadwalLabel(j.id_jadwal))}</option>`).join('')}</select>
        <button class="btn sm ghost" id="exp">${icon('download')} CSV</button></div>
        <div class="toolbar" id="bulk" hidden><b id="nsel"></b><button class="btn sm" id="bKel">Kelengkapan…</button><button class="btn sm" id="bVer">Verifikasi…</button><button class="btn sm" id="bPlot">Tetapkan jadwal…</button><button class="btn sm" id="bAs">Status asesmen…</button><button class="btn sm ghost" id="bClr">Batal pilih</button></div>
        <div class="table-wrap"><table><thead><tr><th><input type="checkbox" id="ckAll"></th><th>No. Reg</th><th>Nama</th><th>Skema / jadwal</th><th>Kelengkapan</th><th>Verifikasi</th><th>Jadwal</th><th>Asesmen</th><th>Hasil</th><th>Sertifikat</th></tr></thead><tbody id="tb"></tbody></table></div>`;
      const sel = new Set();
      let rows = [];
      const draw = () => {
        const q = $('#q').value.toLowerCase().trim(), fj = $('#fj').value;
        $('#tabs').innerHTML = Object.keys(TABS).map(k => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${esc(TABS[k][0])}<span class="n">${all.filter(TABS[k][1]).length}</span></button>`).join('');
        rows = all.filter(TABS[tab][1]).filter(r => (!fj || r.id_jadwal === fj) && (!q || [r.nama, r.no_reg, r.nik, r.email, r.nim].join(' ').toLowerCase().indexOf(q) >= 0));
        $('#tb').innerHTML = rows.length ? rows.map(r => `<tr class="clickable" data-no="${esc(r.no_reg)}">
          <td onclick="event.stopPropagation()"><input type="checkbox" class="ck" value="${esc(r.no_reg)}" ${sel.has(r.no_reg) ? 'checked' : ''}></td>
          <td class="mono">${esc(r.no_reg)}<br><small class="muted">${tgl(r.waktu_daftar)}</small></td><td><b>${esc(r.nama)}</b><br><small class="muted">${esc(r.email)}</small></td>
          <td>${esc(nmSkema(r.id_skema))}<br><small class="muted">${esc(jadwalLabel(r.id_jadwal))}</small></td>
          <td>${badge(kl(r))}</td><td>${badge(r.status_verifikasi)}</td><td>${badge(r.status_jadwal)}${r.tanggal_asesmen ? '<br><small>' + tgl(r.tanggal_asesmen) + '</small>' : ''}</td>
          <td>${badge(r.status_asesmen)}</td><td>${r.rekomendasi ? badge(r.rekomendasi) : '<small class="muted">-</small>'}</td><td>${r.rekomendasi === 'Kompeten' ? badge(r.status_sertifikat) : '<small class="muted">-</small>'}</td></tr>`).join('')
          : '<tr><td colspan="10" class="empty">Tidak ada data.</td></tr>';
        $('#bulk').hidden = !sel.size;
        $('#nsel').textContent = sel.size + ' dipilih';
        $('#ckAll').checked = rows.length && rows.every(r => sel.has(r.no_reg));
      };
      $('#tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) { tab = b.dataset.t; sel.clear(); history.replaceState(null, '', '#/pendaftar/' + tab); draw(); } };
      $('#q').oninput = draw; $('#fj').onchange = draw;
      $('#tb').onclick = (e) => { const tr = e.target.closest('tr[data-no]'); if (tr) detail(tr.dataset.no, () => route()); };
      $('#tb').onchange = (e) => { if (e.target.classList.contains('ck')) { e.target.checked ? sel.add(e.target.value) : sel.delete(e.target.value); draw(); } };
      $('#ckAll').onchange = (e) => { rows.forEach(r => e.target.checked ? sel.add(r.no_reg) : sel.delete(r.no_reg)); draw(); };
      $('#bClr').onclick = () => { sel.clear(); draw(); };
      $('#bKel').onclick = () => bulkForm([...sel], 'kelengkapan');
      $('#bVer').onclick = () => bulkForm([...sel], 'verifikasi');
      $('#bPlot').onclick = () => bulkForm([...sel], 'plotting');
      $('#bAs').onclick = () => bulkForm([...sel], 'asesmen');
      $('#exp').onclick = () => csv(rows.map(r => Object.assign({}, r, { skema: nmSkema(r.id_skema), asesor: nmAsesor(r.id_asesor), tuk: nmTuk(r.id_tuk) })), [
        { key: 'no_reg', label: 'No Registrasi' }, { key: 'waktu_daftar', label: 'Waktu Daftar' }, { key: 'nama', label: 'Nama' }, { key: 'nik', label: 'NIK' }, { key: 'nim', label: 'NIM' },
        { key: 'email', label: 'Email' }, { key: 'hp', label: 'HP' }, { key: 'skema', label: 'Skema' }, { key: 'id_jadwal', label: 'Jadwal' }, { key: 'status_verifikasi', label: 'Verifikasi' },
        { key: 'tanggal_asesmen', label: 'Tgl Asesmen' }, { key: 'asesor', label: 'Asesor' }, { key: 'tuk', label: 'TUK' }, { key: 'status_asesmen', label: 'Asesmen' },
        { key: 'rekomendasi', label: 'Rekomendasi' }, { key: 'status_sertifikat', label: 'Sertifikat' }, { key: 'no_sertifikat', label: 'No Sertifikat' }], 'pendaftar-' + tab + '.csv');
      draw();
    },

    async plotting(v) {
      const all = await api('listPendaftar');
      v.innerHTML = `<div class="notice info">Langkah 4 SOP — menyusun jadwal asesmen, menentukan asesor dan TUK sesuai skema, lalu menyampaikan jadwal kepada peserta (otomatis tampil di halaman Plotting &amp; Status peserta).</div>
        <div class="card form"><label class="f">Pilih jadwal<select id="pj"><option value="">Pilih…</option>${REF.Jadwal.map(j => `<option value="${esc(j.id_jadwal)}">${esc(jadwalLabel(j.id_jadwal))} (${esc(j.id_jadwal)})</option>`).join('')}</select></label></div><div id="pOut"></div>`;
      $('#pj').onchange = () => {
        const j = REF.Jadwal.find(x => x.id_jadwal === $('#pj').value);
        if (!j) { $('#pOut').innerHTML = ''; return; }
        const rows = all.filter(r => r.id_jadwal === j.id_jadwal && r.status_verifikasi === 'Memenuhi Syarat');
        const belum = rows.filter(r => r.status_jadwal !== 'Terjadwal');
        const asesor = REF.Asesor.filter(a => a.status !== 'Nonaktif' && (!a.skema || a.skema.split(/[,;\s]+/).indexOf(j.id_skema) >= 0));
        $('#pOut').innerHTML = `<div class="card"><h3>Peserta memenuhi syarat · ${rows.length} orang (${belum.length} belum dijadwalkan)</h3>
          <div class="table-wrap" style="margin-bottom:14px"><table><thead><tr><th><input type="checkbox" id="pAll" checked></th><th>No. Reg</th><th>Nama</th><th>Status</th><th>Asesor</th><th>TUK</th><th>Tanggal</th></tr></thead><tbody>
          ${rows.map(r => `<tr><td><input type="checkbox" class="pk" value="${esc(r.no_reg)}" ${r.status_jadwal !== 'Terjadwal' ? 'checked' : ''}></td><td class="mono">${esc(r.no_reg)}</td><td>${esc(r.nama)}</td><td>${badge(r.status_jadwal)}</td><td>${esc(r.id_asesor ? nmAsesor(r.id_asesor) : '-')}</td><td>${esc(r.id_tuk ? nmTuk(r.id_tuk) : '-')}</td><td>${r.tanggal_asesmen ? tgl(r.tanggal_asesmen) : '-'}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Belum ada peserta yang memenuhi syarat pada jadwal ini.</td></tr>'}
          </tbody></table></div>
          <form class="form" id="fP"><div class="row"><label class="f">Asesor kompetensi<select name="id_asesor" required><option value="">Pilih…</option>${asesor.map(a => `<option value="${esc(a.id_asesor)}">${esc(a.nama_asesor)} · ${esc(a.no_reg_met || '')}</option>`).join('')}</select><small class="muted">Hanya asesor dengan skema ${esc(j.id_skema)} (kosongkan kolom skema asesor agar tampil untuk semua).</small></label>
          <label class="f">TUK<select name="id_tuk" required>${REF.TUK.map(t => `<option value="${esc(t.id_tuk)}" ${t.id_tuk === j.id_tuk ? 'selected' : ''}>${esc(t.nama_tuk)}</option>`).join('')}</select></label></div>
          <div class="row"><label class="f">Tanggal asesmen<input type="date" name="tanggal_asesmen" value="${esc(j.tanggal)}" required></label><label class="f">Waktu<input name="waktu_asesmen" value="${esc(j.waktu || '')}"></label></div>
          <div><button class="btn" type="submit">${icon('send')} Tetapkan untuk peserta terpilih</button></div></form></div>`;
        $('#pAll').onchange = (e) => $$('.pk').forEach(c => c.checked = e.target.checked);
        $('#fP').onsubmit = (e) => {
          e.preventDefault();
          const regs = $$('.pk').filter(c => c.checked).map(c => c.value);
          busy($('#fP button'), async () => {
            try { const r = await api('updatePendaftar', { no_regs: regs, tahap: 'plotting', nilai: formData($('#fP')) }); toast(r.diperbarui + ' peserta dijadwalkan.', 'ok'); route(); }
            catch (err) { toast(err.message, 'bad'); }
          });
        };
      };
    },

    async keluhan(v) { await tiketPage(v, 'Keluhan'); },
    async layanan(v) { await tiketPage(v, 'Layanan'); },

    async survei(v) {
      const rows = await api('listSheet', { sheet: 'Survei' });
      const K = [['skor_informasi', 'Informasi'], ['skor_administrasi', 'Administrasi'], ['skor_asesmen', 'Asesmen'], ['skor_petugas', 'Admin'], ['skor_keseluruhan', 'Keseluruhan']];
      const avg = (k) => rows.length ? (rows.reduce((a, r) => a + Number(r[k] || 0), 0) / rows.length).toFixed(2) : '-';
      v.innerHTML = `<div class="grid g4" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-bottom:16px">${K.map(k => `<div class="stat"><div class="k">${k[1]}</div><div class="v">${avg(k[0])}</div></div>`).join('')}</div>
        <div class="card"><div class="card-head"><h3>${rows.length} respons</h3><button class="btn sm ghost" id="exp">${icon('download')} CSV</button></div>
        <div class="table-wrap"><table><thead><tr><th>Waktu</th><th>No. Reg</th>${K.map(k => `<th>${k[1]}</th>`).join('')}<th>Saran</th></tr></thead><tbody>
        ${rows.slice().reverse().map(r => `<tr><td>${tgl(r.waktu)}</td><td class="mono">${esc(r.no_reg || '-')}</td>${K.map(k => `<td>${esc(r[k[0]])}</td>`).join('')}<td>${esc(r.saran)}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Belum ada respons.</td></tr>'}</tbody></table></div></div>`;
      $('#exp').onclick = () => csv(rows, [{ key: 'waktu' }, { key: 'no_reg' }].concat(K.map(k => ({ key: k[0], label: k[1] }))).concat([{ key: 'saran' }]), 'survei-kepuasan.csv');
    },

    async rekaman(v) {
      const rows = await api('listSheet', { sheet: 'Log' });
      v.innerHTML = `<div class="notice info">Langkah 10 SOP — seluruh aktivitas pelayanan tercatat otomatis (waktu, admin, peran, langkah SOP, referensi) sehingga mampu telusur. Data utama tersimpan di Google Spreadsheet; berkas peserta di Google Drive.</div>
        <div class="toolbar"><input id="q" placeholder="Cari No. Reg / tiket / admin / aktivitas…"><select id="fl"><option value="">Semua langkah</option>${SOP.langkah.map(l => `<option value="${l.no}">L${l.no} ${esc(l.nama)}</option>`).join('')}</select><button class="btn sm ghost" id="exp">${icon('download')} CSV</button></div>
        <div id="lt"></div>`;
      let cur = rows;
      const draw = () => {
        const q = $('#q').value.toLowerCase(), l = $('#fl').value;
        cur = rows.filter(r => (!l || String(r.langkah_sop) === l) && (!q || [r.ref, r.aktor, r.aksi, r.detail].join(' ').toLowerCase().indexOf(q) >= 0));
        $('#lt').innerHTML = logTable(cur.slice(0, 500)) + (cur.length > 500 ? `<p class="muted">Menampilkan 500 dari ${cur.length}. Gunakan filter atau unduh CSV.</p>` : '');
      };
      $('#q').oninput = draw; $('#fl').onchange = draw;
      $('#exp').onclick = () => csv(cur, ['waktu', 'aktor', 'peran', 'langkah_sop', 'aksi', 'ref', 'detail'].map(k => ({ key: k })), 'rekaman-pelayanan.csv');
      draw();
    },

    async pengguna(v) {
      if (USER.peran !== 'Admin') { v.innerHTML = '<div class="notice">Pengelolaan pengguna hanya untuk peran Admin.</div>'; return; }
      const rows = await api('listUsers');
      v.innerHTML = `<div class="card"><div class="card-head"><h3>Pengguna panel admin</h3><button class="btn sm" id="add">${icon('plus')} Tambah</button></div>
        <div class="table-wrap"><table><thead><tr><th>Username</th><th>Nama</th><th>Peran</th><th>Aktif</th></tr></thead><tbody>
        ${rows.map(u => `<tr class="clickable" data-u="${esc(u.username)}"><td class="mono">${esc(u.username)}</td><td>${esc(u.nama)}</td><td>${esc(u.peran)}</td><td>${badge(u.aktif)}</td></tr>`).join('')}</tbody></table></div>
        <p class="muted" style="margin-top:12px">Peran mengikuti penanggung jawab SOP: Sekretariat LSP (L1, L5, L10), Bagian Administrasi (L2, L8), Bagian Sertifikasi (L3, L4, L6, L7), Bagian Manajemen Mutu (L9). Admin dapat melakukan semua tahap.</p></div>`;
      const open = (u) => {
        const m = modal(u ? 'Ubah pengguna' : 'Tambah pengguna', `<form class="form" id="fU">
          <label class="f">Username<input name="username" value="${esc(u ? u.username : '')}" ${u ? 'readonly' : ''} required></label>
          <label class="f">Nama<input name="nama" value="${esc(u ? u.nama : '')}" required></label>
          <div class="row"><label class="f">Peran<select name="peran">${['Admin', 'Sekretariat LSP', 'Bagian Administrasi', 'Bagian Sertifikasi', 'Bagian Manajemen Mutu'].map(p => `<option ${u && u.peran === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
          <label class="f">Aktif<select name="aktif"><option ${u && u.aktif === 'YA' ? 'selected' : ''}>YA</option><option ${u && u.aktif === 'TIDAK' ? 'selected' : ''}>TIDAK</option></select></label></div>
          <label class="f">Password ${u ? '<small>(kosongkan jika tidak diubah)</small>' : ''}<input type="password" name="password" minlength="8" autocomplete="new-password"></label>
          <div><button class="btn" type="submit">Simpan</button></div></form>`);
        $('#fU', m.el).onsubmit = (e) => { e.preventDefault(); busy($('#fU button', m.el), async () => { try { await api('saveUser', formData($('#fU', m.el))); toast('Tersimpan', 'ok'); m.close(); route(); } catch (err) { toast(err.message, 'bad'); } }); };
      };
      $('#add').onclick = () => open(null);
      $$('tr[data-u]', v).forEach(tr => tr.onclick = () => open(rows.find(r => r.username === tr.dataset.u)));
    },

    async akun(v) {
      v.innerHTML = `<form class="card form" id="fPw" style="max-width:480px"><h3>Ganti password</h3>
        <label class="f">Password lama<input type="password" name="lama" required autocomplete="current-password"></label>
        <label class="f">Password baru (min. 8 karakter)<input type="password" name="baru" required minlength="8" autocomplete="new-password"></label>
        <div><button class="btn" type="submit">Simpan</button></div></form>`;
      $('#fPw').onsubmit = (e) => { e.preventDefault(); busy($('#fPw button'), async () => { try { await api('changePassword', formData($('#fPw'))); toast('Password diganti.', 'ok'); $('#fPw').reset(); } catch (err) { toast(err.message, 'bad'); } }); };
    }
  };

  function logTable(rows) {
    return `<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>L</th><th>Aktivitas</th><th>Ref</th><th>Admin</th></tr></thead><tbody>
      ${rows.map(l => `<tr><td style="white-space:nowrap">${tgl(l.waktu)}</td><td><span class="badge info">${esc(l.langkah_sop)}</span></td><td>${esc(l.aksi)}${l.detail ? '<br><small class="muted">' + esc(l.detail) + '</small>' : ''}</td><td class="mono">${esc(l.ref)}</td><td>${esc(l.aktor)}<br><small class="muted">${esc(l.peran)}</small></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Belum ada rekaman.</td></tr>'}
    </tbody></table></div>`;
  }

  /* ---------------- Detail peserta & formulir tahapan ---------------- */
  function stageForms(r) {
    const opt = (arr, cur) => arr.map(o => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('');
    const asesor = REF.Asesor.filter(a => a.status !== 'Nonaktif');
    const j = REF.Jadwal.find(x => x.id_jadwal === r.id_jadwal) || {};
    const T = tahapPeserta(r);
    const head = (no, title) => `<summary><b>L${no} · ${esc(title)}</b> ${T[no] && T[no].st === 'done' ? badge('Selesai') : T[no] && T[no].st === 'fail' ? badge('Ditolak') : T[no] && T[no].st === 'now' ? badge('Diproses') : ''} <small class="muted">PJ: ${esc(PJ[no])}</small></summary>`;
    const box = (no, title, body, open) => `<details class="card" style="padding:14px;margin-bottom:10px" ${open ? 'open' : ''}>${head(no, title)}<form class="form" style="margin-top:12px" data-tahap="${body.tahap}">${body.html}${body.html.indexOf('Menunggu berkas dinyatakan') >= 0 ? '' : `<div><button class="btn sm" type="submit">Simpan L${no}</button></div>`}</form></details>`;
    const now = (no) => T[no] && T[no].st === 'now';
    const cekB = String(r.cek_berkas || '').split(',');
    const cekP = String(r.cek_persyaratan || '').split(',');
    const syarat = syaratSkema(r.id_skema);
    const lengkap = kl(r) === 'Lengkap';
    return [
      box(2, 'Pemeriksaan kelengkapan berkas', { tahap: 'kelengkapan', html: `<div><b style="font-size:.88rem">Centang berkas yang sudah sesuai</b>
        ${BERKAS.map(b => `<label class="check"><input type="checkbox" data-list="cek_berkas" value="${b[0].replace('file_', '')}" ${cekB.indexOf(b[0].replace('file_', '')) >= 0 ? 'checked' : ''} ${r[b[0]] ? '' : 'disabled'}> <span>${esc(b[1])} ${r[b[0]] ? `— <a href="${esc(r[b[0]])}" target="_blank" rel="noopener">buka</a>` : '<span class="muted">(tidak diunggah)</span>'}</span></label>`).join('')}</div>
        <label class="f">Hasil pemeriksaan<select name="status_kelengkapan">${opt(['Menunggu Pemeriksaan', 'Lengkap', 'Belum Lengkap'], kl(r))}</select></label>
        <label class="f">Catatan (wajib bila belum lengkap — tampil ke peserta)<textarea name="catatan_kelengkapan" style="min-height:60px">${esc(r.catatan_kelengkapan)}</textarea></label>
        <small class="muted">Lengkap → peserta diminta datang verifikasi langsung membawa berkas asli. Belum Lengkap → peserta mengunggah ulang dari halaman Status.</small>` }, kl(r) !== 'Lengkap'),
      box(3, 'Verifikasi langsung berkas asli', { tahap: 'verifikasi', html: lengkap ? `<label class="check"><input type="checkbox" name="verifikasi_langsung" ${r.verifikasi_langsung === 'YA' ? 'checked' : ''}> <span><b>Berkas asli sudah diperiksa dan dicocokkan dengan unggahan</b> (peserta hadir)</span></label>
        <div><b style="font-size:.88rem">Persyaratan skema yang terpenuhi</b>${syarat.map((t, i) => `<label class="check"><input type="checkbox" data-list="cek_persyaratan" value="${i + 1}" ${cekP.indexOf(String(i + 1)) >= 0 ? 'checked' : ''}> <span>${esc(t)}</span></label>`).join('') || '<p class="muted">Persyaratan skema belum diisi.</p>'}</div>
        <label class="f">Hasil verifikasi<select name="status_verifikasi">${opt(['Menunggu Verifikasi', 'Memenuhi Syarat', 'Perlu Perbaikan', 'Tidak Memenuhi Syarat'], r.status_verifikasi)}</select></label>
        <label class="f">Catatan (tampil ke peserta)<textarea name="catatan_verifikasi" style="min-height:60px">${esc(r.catatan_verifikasi)}</textarea></label>
        <small class="muted">Rekomendasi APL-01 otomatis: Memenuhi Syarat → Diterima; Tidak Memenuhi Syarat → Tidak diterima.${r.rekomendasi_apl01 ? ' Saat ini: <b>' + esc(r.rekomendasi_apl01) + '</b>.' : ''}</small>`
        : '<p class="muted" style="margin:0">Menunggu berkas dinyatakan <b>Lengkap</b> oleh Bagian Administrasi (L2).</p>' }, lengkap && now(3)),
      box(4, 'Penjadwalan: asesor & TUK', { tahap: 'plotting', html: `<div class="row"><label class="f">Asesor<select name="id_asesor"><option value="">Pilih…</option>${asesor.map(a => `<option value="${esc(a.id_asesor)}" ${a.id_asesor === r.id_asesor ? 'selected' : ''}>${esc(a.nama_asesor)}</option>`).join('')}</select></label><label class="f">TUK<select name="id_tuk">${REF.TUK.map(t => `<option value="${esc(t.id_tuk)}" ${t.id_tuk === (r.id_tuk || j.id_tuk) ? 'selected' : ''}>${esc(t.nama_tuk)}</option>`).join('')}</select></label></div><div class="row"><label class="f">Tanggal<input type="date" name="tanggal_asesmen" value="${esc(r.tanggal_asesmen || j.tanggal || '')}"></label><label class="f">Waktu<input name="waktu_asesmen" value="${esc(r.waktu_asesmen || j.waktu || '')}"></label></div>` }, now(4)),
      box(5, 'Administrasi asesmen', { tahap: 'asesmen', html: `<label class="f">Status<select name="status_asesmen">${opt(['Belum', 'Dokumen Siap'], r.status_asesmen)}</select></label><label class="f">Catatan (dokumen asesmen, daftar hadir, berita acara)<textarea name="catatan_asesmen" style="min-height:60px">${esc(r.catatan_asesmen)}</textarea></label>` }, now(5)),
      box(6, 'Pelaksanaan pelayanan sertifikasi', { tahap: 'pelaksanaan', html: `<label class="f">Kehadiran / pelaksanaan<select name="status_asesmen">${opt(['Dokumen Siap', 'Hadir', 'Tidak Hadir'], r.status_asesmen)}</select></label><label class="f">Catatan pendampingan<textarea name="catatan_asesmen" style="min-height:60px">${esc(r.catatan_asesmen)}</textarea></label>` }, now(6)),
      box(7, 'Penyampaian hasil sertifikasi', { tahap: 'hasil', html: `<label class="f">Keputusan<select name="rekomendasi"><option value="">Pilih…</option>${opt(['Kompeten', 'Belum Kompeten'], r.rekomendasi)}</select></label><label class="f">Link surat pemberitahuan hasil (Drive, akses: siapa saja yang memiliki link)<input name="link_surat_hasil" value="${esc(r.link_surat_hasil)}" placeholder="https://drive.google.com/…"></label><label class="f">Catatan untuk peserta<textarea name="catatan_hasil" style="min-height:60px">${esc(r.catatan_hasil)}</textarea></label><small class="muted">Halaman hasil peserta otomatis menampilkan informasi hak banding dan keluhan.</small>` }, now(7)),
      box(8, 'Penyerahan sertifikat', { tahap: 'sertifikat', html: `<div class="row"><label class="f">Status<select name="status_sertifikat">${opt(['Belum Terbit', 'Diajukan ke BNSP', 'Siap Diambil', 'Sudah Diserahkan'], r.status_sertifikat)}</select></label><label class="f">No. sertifikat<input name="no_sertifikat" value="${esc(r.no_sertifikat)}"></label></div><label class="f">Diterima oleh (tanda terima)<input name="penerima" value="${esc(r.penerima)}" placeholder="Nama penerima / kuasa"></label>` }, now(8))
    ].join('');
  }

  async function detail(no, onChange) {
    const m = modal('Peserta ' + no, loading(), { wide: true, headExtra: `<button class="btn sm ghost no-print" id="pr">${icon('print')} Cetak rekaman</button>`, onClose: () => changed && onChange && onChange() });
    let changed = false;
    let current = null;
    $('#pr', m.el).onclick = () => { if (current) cetakRekaman(current); else toast('Data belum selesai dimuat.', 'bad'); };
    const load = async () => {
      const d = await api('detailPendaftar', { no_reg: no });
      current = d;
      const r = d.data;
      const file = (k, l) => r[k] ? `<a href="${esc(r[k])}" target="_blank" rel="noopener">${esc(l)}</a>` : `<span class="muted">${esc(l)}: —</span>`;
      m.body.innerHTML = `
        <div class="print-only"><h2>Rekaman Pelayanan Sertifikasi — ${esc(CFG.NAMA_LSP || 'LSP UNIMED')}</h2><p>SOP ${esc(SOP.nomor)} · dicetak ${tgl(new Date().toISOString().slice(0, 10))} oleh ${esc(USER.nama)}</p></div>
        <div class="grid g2">
          <div>
            <div class="card"><h3>${esc(r.nama)}</h3><dl class="kv">
              <dt>No. Registrasi</dt><dd class="mono">${esc(r.no_reg)}</dd><dt>NIK</dt><dd class="mono">${esc(r.nik)}</dd><dt>NIM</dt><dd>${esc(r.nim || '-')}</dd>
              <dt>TTL</dt><dd>${esc(r.tempat_lahir)}, ${tgl(r.tanggal_lahir)}</dd><dt>Jenis kelamin</dt><dd>${esc(r.jenis_kelamin)}</dd>
              <dt>Email / HP</dt><dd>${esc(r.email)} · ${esc(r.hp)}</dd><dt>Alamat</dt><dd>${esc(r.alamat)}</dd>
              <dt>Pendidikan</dt><dd>${esc(r.pendidikan)} · ${esc(r.instansi)}</dd><dt>Pekerjaan</dt><dd>${esc(r.pekerjaan || '-')}</dd>
              <dt>Tujuan asesmen</dt><dd>${esc(r.tujuan_asesmen)}</dd><dt>Skema</dt><dd>${esc(nmSkema(r.id_skema))}</dd><dt>Jadwal pilihan</dt><dd>${esc(jadwalLabel(r.id_jadwal))}</dd>
              <dt>Asesor / TUK</dt><dd>${r.id_asesor ? esc(nmAsesor(r.id_asesor)) + ' · ' + esc(nmTuk(r.id_tuk)) : '-'}</dd>
              <dt>Berkas (L2)</dt><dd style="display:flex;flex-wrap:wrap;gap:10px">${BERKAS.map(b => file(b[0], b[1])).join('')}</dd>
              <dt>Kelengkapan</dt><dd>${badge(kl(r))}</dd><dt>Verifikasi langsung</dt><dd>${r.verifikasi_langsung === 'YA' ? badge('YA') : '-'} ${r.rekomendasi_apl01 ? '· APL-01 ' + badge(r.rekomendasi_apl01) : ''}</dd>
            </dl></div>
            <div class="card"><h3>Status tahapan</h3><ul class="timeline">${SOP.langkah.filter(l => tahapPeserta(r)[l.no]).map(l => { const t = tahapPeserta(r)[l.no]; return `<li class="${t.st === 'done' ? 'done' : t.st === 'now' ? 'now' : t.st === 'fail' ? 'fail' : ''}"><span class="dot">${t.st === 'done' ? '✓' : l.no}</span><b>${esc(l.nama)}</b><small>${esc(t.info || '')}</small></li>`; }).join('')}</ul></div>
          </div>
          <div class="no-print">${stageForms(r)}
            <details class="card" style="padding:14px"><summary><b>L2 · Koreksi data pemohon</b> <small class="muted">PJ: Bagian Administrasi</small></summary>
              <form class="form" style="margin-top:12px" data-tahap="data">
                <div class="row"><label class="f">Nama<input name="nama" value="${esc(r.nama)}"></label><label class="f">Email<input name="email" value="${esc(r.email)}"></label></div>
                <div class="row"><label class="f">HP<input name="hp" value="${esc(r.hp)}"></label><label class="f">Pindah jadwal<select name="id_jadwal">${REF.Jadwal.filter(x => x.id_skema === r.id_skema).map(x => `<option value="${esc(x.id_jadwal)}" ${x.id_jadwal === r.id_jadwal ? 'selected' : ''}>${esc(jadwalLabel(x.id_jadwal))}</option>`).join('')}</select></label></div>
                <div><button class="btn sm" type="submit">Simpan koreksi</button></div></form></details>
          </div>
        </div>
        <div class="card"><h3>Rekaman pelayanan (L10)</h3>${logTable(d.logs)}</div>
        ${d.layanan.length || d.keluhan.length ? `<div class="card"><h3>Tiket terkait</h3><ul>${d.layanan.map(x => `<li class="mono">${esc(x.no_layanan)} — ${esc(x.jenis)} · ${esc(x.status)}</li>`).join('')}${d.keluhan.map(x => `<li class="mono">${esc(x.no_tiket)} — Keluhan ${esc(x.kategori)} · ${esc(x.status)}</li>`).join('')}</ul></div>` : ''}`;
      $$('form[data-tahap]', m.body).forEach(f => f.addEventListener('submit', (e) => {
        e.preventDefault();
        busy($('button[type=submit]', f), async () => {
          try { await api('updatePendaftar', { no_regs: [no], tahap: f.dataset.tahap, nilai: nilaiForm(f) }); changed = true; toast('Tersimpan & tercatat di rekaman.', 'ok'); await load(); }
          catch (err) { toast(err.message, 'bad'); }
        });
      }));
    };
    try { await load(); } catch (e) { m.body.innerHTML = `<div class="notice bad">${esc(e.message)}</div>`; }
  }

  /* ---------------- Cetak rekaman pelayanan (dokumen A4 rapi) ---------------- */
  function cetakRekaman(d) {
    const r = d.data;
    const T = tahapPeserta(r);
    const logo = new URL(CFG.LOGO_FULL || 'assets/img/logo-lsp.png', location.href).href;
    const row = (k, v) => `<tr><th>${esc(k)}</th><td>${esc(v || '-')}</td></tr>`;
    const status = (no) => { const t = T[no]; if (!t) return 'Tidak berlaku'; return ({ done: 'Selesai', now: 'Dalam proses', fail: 'Tidak lanjut', skip: 'Tidak berlaku', wait: 'Belum' }[t.st] || '-') + (t.info ? ' — ' + t.info : ''); };
    const berkas = BERKAS;
    const cekB = String(r.cek_berkas || '').split(',');
    const cekP = String(r.cek_persyaratan || '').split(',');
    const syarat = syaratSkema(r.id_skema);
    const sekarang = new Date();
    const tglCetak = tgl(sekarang.getFullYear() + '-' + String(sekarang.getMonth() + 1).padStart(2, '0') + '-' + String(sekarang.getDate()).padStart(2, '0')) + ', ' + String(sekarang.getHours()).padStart(2, '0') + '.' + String(sekarang.getMinutes()).padStart(2, '0');
    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Rekaman ${esc(r.no_reg)}</title><style>
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #000; line-height: 1.4; }
      .page { padding: 0 16mm; }
      table.wrap, table.wrap > * > tr > td { border: 0; padding: 0; }
      .sp { height: 14mm; }
      .kop { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14px; }
      .kop img { height: 62px; }
      .kop h1 { font-size: 15pt; margin: 0 0 2px; }
      .kop p { margin: 0; }
      h2 { font-size: 11.5pt; margin: 16px 0 6px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; text-align: left; }
      .id th { width: 32%; font-weight: normal; }
      thead th { font-weight: bold; background: #eee; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; break-inside: avoid; }
      .ttd { display: flex; justify-content: space-between; margin-top: 26px; page-break-inside: avoid; }
      .ttd > div { width: 45%; }
      .ttd .garis { margin-top: 60px; border-top: 1px solid #000; padding-top: 3px; }
      .catatan { margin-top: 10px; }
    </style></head><body><table class="wrap"><thead><tr><td><div class="sp"></div></td></tr></thead><tfoot><tr><td><div class="sp"></div></td></tr></tfoot><tbody><tr><td><div class="page">
      <div class="kop"><img src="${logo}" alt=""><div><h1>Rekaman Pelayanan Sertifikasi</h1>
        <p>${esc(CFG.NAMA_LSP || 'LSP UNIMED')} — Lembaga Sertifikasi Profesi Universitas Negeri Medan</p>
        <p>Acuan: SOP ${esc(SOP.nomor)} ${esc(SOP.judul)} (Rev. ${esc(SOP.revisi)})</p></div></div>

      <h2>A. Identitas peserta</h2>
      <table class="id">
        ${row('No. Registrasi', r.no_reg)}${row('Nama lengkap', r.nama)}${row('NIK', r.nik)}${row('NIM', r.nim)}
        ${row('Tempat, tanggal lahir', r.tempat_lahir + ', ' + tgl(r.tanggal_lahir))}${row('Jenis kelamin', r.jenis_kelamin)}
        ${row('Email / No. HP', r.email + ' / ' + r.hp)}${row('Alamat', r.alamat)}
        ${row('Pendidikan / instansi', [r.pendidikan, r.instansi].filter(String).join(' — '))}${row('Pekerjaan', r.pekerjaan)}
        ${row('Tujuan asesmen', r.tujuan_asesmen)}${row('Skema sertifikasi', nmSkema(r.id_skema))}
        ${row('Jadwal pilihan', jadwalLabel(r.id_jadwal))}${row('Tanggal daftar', tgl(r.waktu_daftar))}
        ${row('Asesor', r.id_asesor ? nmAsesor(r.id_asesor) : '-')}${row('TUK', r.id_tuk ? nmTuk(r.id_tuk) : '-')}
        ${row('Jadwal asesmen', r.tanggal_asesmen ? tgl(r.tanggal_asesmen, true) + (r.waktu_asesmen ? ', ' + r.waktu_asesmen : '') : '-')}
        ${row('Keputusan', r.rekomendasi || 'Belum ada')}${row('No. sertifikat', r.no_sertifikat)}
      </table>

      <h2>B. Pemeriksaan kelengkapan berkas (L2)</h2>
      <table><thead><tr><th style="width:7%">No</th><th>Berkas</th><th style="width:18%">Unggahan</th><th style="width:18%">Diperiksa</th></tr></thead><tbody>
        ${berkas.map((b, i) => `<tr><td>${i + 1}</td><td>${b[1]}</td><td>${r[b[0]] ? 'Diunggah' : 'Tidak ada'}</td><td>${cekB.indexOf(b[0].replace('file_', '')) >= 0 ? 'Sesuai' : '-'}</td></tr>`).join('')}
      </tbody></table>
      <p class="catatan"><b>Hasil:</b> ${esc(r.status_kelengkapan || 'Menunggu Pemeriksaan')}${r.tgl_kelengkapan ? ' (' + esc(tgl(r.tgl_kelengkapan)) + ')' : ''}${r.catatan_kelengkapan ? ' — ' + esc(r.catatan_kelengkapan) : ''}</p>

      <h2>C. Verifikasi langsung berkas asli (L3)</h2>
      <table><thead><tr><th style="width:7%">No</th><th>Persyaratan skema</th><th style="width:18%">Terpenuhi</th></tr></thead><tbody>
        ${syarat.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t)}</td><td>${cekP.indexOf(String(i + 1)) >= 0 ? 'Ya' : '-'}</td></tr>`).join('') || '<tr><td colspan="3">Persyaratan skema belum diisi.</td></tr>'}
      </tbody></table>
      <p class="catatan"><b>Berkas asli dicocokkan:</b> ${r.verifikasi_langsung === 'YA' ? 'Ya' : 'Belum'} &nbsp; <b>Hasil:</b> ${esc(r.status_verifikasi || '-')}${r.tgl_verifikasi ? ' (' + esc(tgl(r.tgl_verifikasi)) + ')' : ''} &nbsp; <b>Rekomendasi APL-01:</b> ${esc(r.rekomendasi_apl01 || '-')}</p>

      <h2>D. Status tahapan sesuai SOP</h2>
      <table><thead><tr><th style="width:7%">L</th><th style="width:30%">Langkah</th><th style="width:22%">Penanggung jawab</th><th>Status</th></tr></thead><tbody>
        ${SOP.langkah.filter(l => l.no >= 2 && l.no <= 8).map(l => `<tr><td>${l.no}</td><td>${esc(l.nama)}</td><td>${esc(l.pj)}</td><td>${esc(status(l.no))}</td></tr>`).join('')}
      </tbody></table>
      ${r.catatan_verifikasi ? `<p class="catatan"><b>Catatan verifikasi:</b> ${esc(r.catatan_verifikasi)}</p>` : ''}
      ${r.catatan_hasil ? `<p class="catatan"><b>Catatan hasil:</b> ${esc(r.catatan_hasil)}</p>` : ''}

      <h2>E. Rekaman aktivitas pelayanan (L10)</h2>
      <table><thead><tr><th style="width:5%">No</th><th style="width:19%">Waktu</th><th style="width:6%">L</th><th>Aktivitas</th><th style="width:24%">Dilakukan oleh</th></tr></thead><tbody>
        ${d.logs.map((l, i) => `<tr><td>${i + 1}</td><td>${tgl(l.waktu)}</td><td>${esc(l.langkah_sop)}</td><td>${esc(l.aksi)}${l.detail ? '<br>' + esc(l.detail) : ''}</td><td>${esc(l.aktor)}<br>${esc(l.peran)}</td></tr>`).join('') || '<tr><td colspan="5">Belum ada rekaman.</td></tr>'}
      </tbody></table>

      ${d.layanan.length || d.keluhan.length ? `<h2>F. Tiket terkait</h2><table><thead><tr><th style="width:22%">No. tiket</th><th>Jenis</th><th style="width:18%">Status</th></tr></thead><tbody>
        ${d.layanan.map(x => `<tr><td>${esc(x.no_layanan)}</td><td>${esc(x.jenis)}</td><td>${esc(x.status)}</td></tr>`).join('')}
        ${d.keluhan.map(x => `<tr><td>${esc(x.no_tiket)}</td><td>Keluhan: ${esc(x.kategori)}</td><td>${esc(x.status)}</td></tr>`).join('')}</tbody></table>` : ''}

      <div class="ttd">
        <div>Dicetak oleh: ${esc(USER.nama)} (${esc(USER.peran)})<br>Tanggal cetak: ${esc(tglCetak)}</div>
        <div>Medan, ${esc(tgl(sekarang.toISOString().slice(0, 10)))}<br>Mengetahui,<br>Sekretariat LSP<div class="garis">Nama dan tanda tangan</div></div>
      </div>
    </div></td></tr></tbody></table><script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };<\/script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast('Izinkan pop-up untuk mencetak rekaman.', 'bad'); return; }
    w.document.write(html);
    w.document.close();
  }

  function bulkForm(regs, tahap) {
    const opt = (a) => a.map(o => `<option>${esc(o)}</option>`).join('');
    const html = {
      kelengkapan: `<label class="f">Hasil pemeriksaan kelengkapan<select name="status_kelengkapan">${opt(['Lengkap', 'Belum Lengkap', 'Menunggu Pemeriksaan'])}</select></label><label class="f">Catatan (wajib bila belum lengkap)<textarea name="catatan_kelengkapan"></textarea></label>`,
      verifikasi: `<label class="check"><input type="checkbox" name="verifikasi_langsung"> <span>Berkas asli seluruh peserta terpilih sudah diperiksa langsung</span></label><label class="f">Hasil verifikasi<select name="status_verifikasi">${opt(['Memenuhi Syarat', 'Perlu Perbaikan', 'Tidak Memenuhi Syarat', 'Menunggu Verifikasi'])}</select></label><label class="f">Catatan<textarea name="catatan_verifikasi"></textarea></label>`,
      plotting: `<div class="row"><label class="f">Asesor<select name="id_asesor" required><option value="">Pilih…</option>${REF.Asesor.map(a => `<option value="${esc(a.id_asesor)}">${esc(a.nama_asesor)}</option>`).join('')}</select></label><label class="f">TUK<select name="id_tuk">${REF.TUK.map(t => `<option value="${esc(t.id_tuk)}">${esc(t.nama_tuk)}</option>`).join('')}</select></label></div><div class="row"><label class="f">Tanggal<input type="date" name="tanggal_asesmen" required></label><label class="f">Waktu<input name="waktu_asesmen"></label></div>`,
      asesmen: `<label class="f">Status asesmen<select name="status_asesmen">${opt(['Dokumen Siap', 'Hadir', 'Tidak Hadir', 'Belum'])}</select></label><label class="f">Catatan<textarea name="catatan_asesmen"></textarea></label>`
    }[tahap];
    const realTahap = tahap === 'asesmen' ? null : tahap;
    const m = modal('Perbarui ' + regs.length + ' peserta', `<form class="form" id="fB">${html}<div><button class="btn" type="submit">Simpan</button></div></form>`);
    $('#fB', m.el).onsubmit = (e) => {
      e.preventDefault();
      busy($('#fB button', m.el), async () => {
        try {
          const nilai = nilaiForm($('#fB', m.el));
          const t = realTahap || (['Hadir', 'Tidak Hadir'].indexOf(nilai.status_asesmen) >= 0 ? 'pelaksanaan' : 'asesmen');
          const r = await api('updatePendaftar', { no_regs: regs, tahap: t, nilai });
          toast(r.diperbarui + ' peserta diperbarui.', 'ok'); m.close(); route();
        } catch (err) { toast(err.message, 'bad'); }
      });
    };
  }

  /* ---------------- Keluhan & layanan ---------------- */
  async function tiketPage(v, sheet) {
    const rows = (await api('listSheet', { sheet })).reverse();
    const isK = sheet === 'Keluhan';
    const idk = isK ? 'no_tiket' : 'no_layanan';
    const jenisList = isK ? [] : [...new Set(rows.map(r => r.jenis))];
    v.innerHTML = `${isK ? '<div class="notice info">Langkah 9 SOP — menerima, mencatat, dan menindaklanjuti keluhan. Tanggapan yang disimpan tampil kepada pelapor di menu Lacak Tiket.</div>' : '<div class="notice info">Permohonan banding asesmen, surveilans, legalisir, dan perpanjangan sertifikat (RCC). Tanggapan tampil di menu Lacak Tiket pemohon.</div>'}
      <div class="toolbar"><select id="fs"><option value="">Semua status</option><option>Diterima</option><option>Diproses</option><option>Selesai</option><option>Ditolak</option></select>${isK ? '' : `<select id="fjn"><option value="">Semua jenis</option>${jenisList.map(j => `<option>${esc(j)}</option>`).join('')}</select>`}<input id="q" placeholder="Cari…"></div>
      <div class="table-wrap"><table><thead><tr><th>No. tiket</th><th>Waktu</th><th>Pemohon</th><th>${isK ? 'Kategori' : 'Jenis'}</th><th>Status</th></tr></thead><tbody id="tb"></tbody></table></div>`;
    const draw = () => {
      const s = $('#fs').value, j = $('#fjn') ? $('#fjn').value : '', q = $('#q').value.toLowerCase();
      const list = rows.filter(r => (!s || r.status === s) && (!j || r.jenis === j) && (!q || JSON.stringify(r).toLowerCase().indexOf(q) >= 0));
      $('#tb').innerHTML = list.map(r => `<tr class="clickable" data-id="${esc(r[idk])}"><td class="mono">${esc(r[idk])}</td><td>${tgl(r.waktu)}</td><td>${esc(r.nama)}<br><small class="muted">${esc(r.email)}</small></td><td>${esc(isK ? r.kategori : r.jenis)}</td><td>${badge(r.status)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Tidak ada data.</td></tr>';
    };
    $('#fs').onchange = draw; if ($('#fjn')) $('#fjn').onchange = draw; $('#q').oninput = draw;
    $('#tb').onclick = (e) => {
      const tr = e.target.closest('tr[data-id]'); if (!tr) return;
      const r = rows.find(x => x[idk] === tr.dataset.id);
      const m = modal(r[idk], `<dl class="kv"><dt>Jenis</dt><dd>${esc(isK ? 'Keluhan · ' + r.kategori : r.jenis)}</dd><dt>Waktu</dt><dd>${tgl(r.waktu)}</dd><dt>Pemohon</dt><dd>${esc(r.nama)} · ${esc(r.email)} · ${esc(r.hp)}</dd>
        ${r.no_reg ? `<dt>No. Registrasi</dt><dd class="mono">${esc(r.no_reg)}</dd>` : ''}${r.no_sertifikat ? `<dt>No. Sertifikat</dt><dd>${esc(r.no_sertifikat)}</dd>` : ''}${r.skema ? `<dt>Skema</dt><dd>${esc(r.skema)}</dd>` : ''}
        <dt>Uraian</dt><dd style="font-weight:500;white-space:pre-line">${esc(isK ? r.isi : r.keterangan)}</dd>${r.file ? `<dt>Lampiran</dt><dd><a href="${esc(r.file)}" target="_blank" rel="noopener">Buka berkas</a></dd>` : ''}
        ${r.petugas ? `<dt>Admin</dt><dd>${esc(r.petugas)}</dd>` : ''}</dl><hr>
        <form class="form" id="fT"><label class="f">Status<select name="status">${['Diterima', 'Diproses', 'Selesai', 'Ditolak'].map(s => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label class="f">${isK ? 'Tindak lanjut / tanggapan' : 'Catatan admin'} (tampil ke pemohon)<textarea name="catatan">${esc(isK ? r.tindak_lanjut : r.catatan_petugas)}</textarea></label>
        <div><button class="btn" type="submit">Simpan</button></div></form>`);
      $('#fT', m.el).onsubmit = (ev) => {
        ev.preventDefault();
        busy($('#fT button', m.el), async () => {
          try { await api('updateTiket', Object.assign({ sheet, id: r[idk] }, formData($('#fT', m.el)))); toast('Tersimpan', 'ok'); m.close(); route(); }
          catch (err) { toast(err.message, 'bad'); }
        });
      };
    };
    draw();
  }

  /* ---------------- Data master ---------------- */
  const sel = (o) => 'select:' + o;
  const MASTER = {
    Skema: { key: 'id_skema', cols: ['kode_skema', 'nama_skema', 'jenis_skema', 'jumlah_unit', 'status'], f: [['id_skema', 'ID (otomatis)', 'id'], ['kode_skema', 'Kode skema', 'text'], ['nama_skema', 'Nama skema', 'text', 1], ['jenis_skema', 'Jenis', sel('KKNI|Okupasi|Klaster')], ['jumlah_unit', 'Jumlah unit kompetensi', 'number'], ['biaya', 'Biaya (Rp, 0 = gratis/ditanggung)', 'number'], ['persyaratan', 'Persyaratan khusus skema ini (satu per baris)', 'textarea'], ['link_dokumen', 'Link dokumen skema', 'url'], ['status', 'Status', sel('Aktif|Nonaktif')]] },
    Jadwal: { key: 'id_jadwal', cols: ['id_jadwal', 'id_skema', 'tanggal', 'id_tuk', 'kuota', 'batas_daftar', 'status'], f: [['id_jadwal', 'ID (otomatis)', 'id'], ['id_skema', 'Skema', 'ref:Skema', 1], ['tanggal', 'Tanggal asesmen', 'date', 1], ['waktu', 'Waktu', 'text'], ['id_tuk', 'TUK', 'ref:TUK', 1], ['kuota', 'Kuota internal (0 = tanpa batas, tidak tampil di publik)', 'number'], ['batas_daftar', 'Batas pendaftaran', 'date'], ['status', 'Status', sel('Dibuka|Ditutup|Selesai')], ['keterangan', 'Keterangan', 'text']] },
    TUK: { key: 'id_tuk', cols: ['id_tuk', 'nama_tuk', 'jenis_tuk', 'alamat', 'status'], f: [['id_tuk', 'ID (otomatis)', 'id'], ['nama_tuk', 'Nama TUK', 'text', 1], ['jenis_tuk', 'Jenis', sel('Sewaktu|Tempat Kerja|Mandiri')], ['alamat', 'Alamat', 'textarea'], ['penanggung_jawab', 'Penanggung jawab', 'text'], ['kontak', 'Kontak', 'text'], ['status', 'Status', sel('Aktif|Nonaktif')]] },
    Asesor: { key: 'id_asesor', cols: ['id_asesor', 'nama_asesor', 'no_reg_met', 'skema', 'status'], f: [['id_asesor', 'ID (otomatis)', 'id'], ['nama_asesor', 'Nama asesor', 'text', 1], ['no_reg_met', 'No. Reg. MET', 'text'], ['skema', 'ID skema yang diampu (pisahkan koma, mis. SKM-001,SKM-002)', 'text'], ['email', 'Email', 'email'], ['hp', 'HP', 'text'], ['status', 'Status', sel('Aktif|Nonaktif')]] },
    Dokumen: { key: 'id_dok', cols: ['nomor', 'judul', 'kategori', 'id_skema', 'status'], f: [['id_dok', 'ID (otomatis)', 'id'], ['nomor', 'Nomor dokumen', 'text'], ['judul', 'Judul', 'text', 1], ['kategori', 'Kategori', sel('SOP|Acuan|Formulir|Skema|Panduan|Lainnya')], ['id_skema', 'Berlaku untuk skema (kosong = semua skema)', 'ref:Skema'], ['link', 'Link (Drive, akses publik)', 'url'], ['status', 'Status', sel('Aktif|Nonaktif')]] },
    Pengaturan: { key: 'kunci', cols: ['kunci', 'nilai', 'keterangan'], f: [['kunci', 'Kunci', 'key', 1], ['nilai', 'Nilai', 'textarea'], ['keterangan', 'Keterangan', 'text']] }
  };

  async function masterPage(v, sheet) {
    const M = MASTER[sheet];
    const rows = await api('listSheet', { sheet });
    const disp = (k, val) => k === 'id_skema' ? esc(nmSkema(val)) : k === 'id_tuk' ? esc(nmTuk(val)) : /tanggal|batas/.test(k) ? tgl(val) : k === 'status' ? badge(val) : esc(String(val || '').slice(0, 120));
    v.innerHTML = `<div class="card"><div class="card-head"><h3>${rows.length} data ${esc(sheet)}</h3><div style="display:flex;gap:8px"><button class="btn sm ghost" id="exp">${icon('download')} CSV</button>${sheet !== 'Pengaturan' || USER.peran === 'Admin' ? `<button class="btn sm" id="add">${icon('plus')} Tambah</button>` : ''}</div></div>
      ${sheet === 'Pengaturan' ? '<div class="notice info">Kunci yang tampil di situs publik: nama_lsp, nama_singkat, tagline, deskripsi, nomor_lisensi, alamat, email, telepon, whatsapp, jam_layanan, pengumuman, link_template_apl02, info_pengambilan_sertifikat, info_verifikasi_langsung.</div>' : ''}
      <div class="table-wrap"><table><thead><tr>${M.cols.map(c => `<th>${esc(c.replace(/_/g, ' '))}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(r => `<tr class="clickable" data-k="${esc(r[M.key])}">${M.cols.map(c => `<td>${disp(c, r[c])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${M.cols.length}" class="empty">Belum ada data.</td></tr>`}
      </tbody></table></div></div>`;
    $('#exp').onclick = () => csv(rows, M.f.map(x => ({ key: x[0], label: x[1] })), sheet.toLowerCase() + '.csv');
    const open = (r) => {
      const isNew = !r;
      r = r || {};
      const input = ([k, label, type, req]) => {
        const val = esc(r[k] || '');
        if (type === 'id') return isNew ? '' : `<label class="f">${esc(label)}<input name="${k}" value="${val}" readonly></label>`;
        if (type === 'key') return `<label class="f">${esc(label)}<input name="${k}" value="${val}" ${isNew ? '' : 'readonly'} required></label>`;
        let ctl;
        if (type.indexOf('select:') === 0) ctl = `<select name="${k}">${type.slice(7).split('|').map(o => `<option ${o === r[k] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
        else if (type.indexOf('ref:') === 0) { const s = type.slice(4); const kk = s === 'Skema' ? 'id_skema' : 'id_tuk'; const nm = s === 'Skema' ? 'nama_skema' : 'nama_tuk'; ctl = `<select name="${k}" ${req ? 'required' : ''}><option value="">${req ? 'Pilih…' : 'Umum (semua skema)'}</option>${REF[s].map(o => `<option value="${esc(o[kk])}" ${o[kk] === r[k] ? 'selected' : ''}>${esc(o[nm])} (${esc(o[kk])})</option>`).join('')}</select>`; }
        else if (type === 'textarea') ctl = `<textarea name="${k}">${val}</textarea>`;
        else ctl = `<input type="${type}" name="${k}" value="${val}" ${req ? 'required' : ''}>`;
        return `<label class="f">${esc(label)} ${req ? '<span class="req">*</span>' : ''}${ctl}</label>`;
      };
      const m = modal((isNew ? 'Tambah ' : 'Ubah ') + sheet, `<form class="form" id="fM">${M.f.map(input).join('')}
        <div style="display:flex;gap:8px;justify-content:space-between"><button class="btn" type="submit">Simpan</button>${!isNew && USER.peran === 'Admin' ? '<button class="btn red" type="button" id="del">Hapus</button>' : ''}</div></form>`);
      const f = $('#fM', m.el);
      f.onsubmit = (e) => {
        e.preventDefault();
        const bad = $$('[required]', f).find(el => !el.value.trim());
        if (bad) { bad.focus(); return toast('Lengkapi kolom bertanda *.', 'bad'); }
        busy($('button[type=submit]', f), async () => {
          try { await api('saveRow', { sheet, row: formData(f), isNew }); toast('Tersimpan', 'ok'); m.close(); await loadRef(); route(); }
          catch (err) { toast(err.message, 'bad'); }
        });
      };
      const del = $('#del', m.el);
      if (del) {
        let armed = false;
        del.onclick = () => {
          if (!armed) { armed = true; del.textContent = 'Klik lagi untuk hapus permanen'; return; }
          busy(del, async () => { try { await api('deleteRow', { sheet, id: r[M.key] }); toast('Dihapus', 'ok'); m.close(); await loadRef(); route(); } catch (err) { toast(err.message, 'bad'); } });
        };
      }
    };
    const add = $('#add'); if (add) add.onclick = () => open(null);
    $$('tr[data-k]', v).forEach(tr => tr.onclick = () => open(rows.find(r => String(r[M.key]) === tr.dataset.k)));
  }

  /* ---------------- Mulai ---------------- */
  (async () => {
    if (!store.get('sipintar_token')) return loginView();
    try { USER = await api('me'); await boot(); } catch (e) { store.del('sipintar_token'); loginView(); }
  })();
})();
