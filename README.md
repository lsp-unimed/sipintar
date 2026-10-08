# SIPINTAR LSP UNIMED

**S**istem **I**nformasi **P**emantauan dan layanan ter**INT**egr**A**si LSP Unive**R**sitas Negeri Medan

Sistem ini mengadopsi alur layanan digital LSP UNS dan memetakannya ke **SOP Pelayanan Kegiatan Sertifikasi (XVII/SOP-PKS, Rev. 03/00)**. Setiap langkah SOP punya fitur, penanggung jawab, dan rekaman otomatis, sehingga proses mampu telusur saat **penyaksian uji kompetensi oleh BNSP**.

- **Frontend**: HTML, CSS, dan JavaScript murni di **GitHub Pages**, tanpa proses build.
- **Backend**: **Google Apps Script** (Web App) dengan **Google Spreadsheet** sebagai basis data dan **Google Drive** untuk berkas unggahan.

---

## 1. Peta SOP → fitur

| Langkah SOP | Penanggung jawab | Fitur publik (asesi) | Fitur panel admin | Rekaman |
|---|---|---|---|---|
| 1 Pelayanan Informasi Sertifikasi | Sekretariat LSP | Beranda, Alur Layanan, Skema, Jadwal, Dokumen Mutu | Data master: Skema, Jadwal, TUK, Asesor, Dokumen, Pengaturan | Log perubahan master |
| 2 Penerimaan Permohonan | Bagian Administrasi | Formulir APL-01 online, unggah KTP/foto/ijazah/APL-02, **No. Registrasi otomatis** | Daftar pendaftar, koreksi data | Sheet `Pendaftaran`, berkas di Drive |
| 3 Verifikasi Persyaratan | Bagian Sertifikasi | Status Pendaftaran (catatan perbaikan tampil) | Verifikasi satuan/massal: Memenuhi / Perlu Perbaikan / Tidak Memenuhi | Log L3 |
| 4 Penjadwalan Sertifikasi | Bagian Sertifikasi | Plotting Jadwal & TUK (nama disamarkan), Status | Plotting massal asesor + TUK + tanggal | Log L4 |
| 5 Pelayanan Administrasi Asesmen | Sekretariat LSP | Status | Status "Dokumen Siap" + catatan | Log L5 |
| 6 Pelaksanaan Pelayanan | Bagian Sertifikasi | Status | Kehadiran Hadir / Tidak Hadir + catatan | Log L6 |
| 7 Penyampaian Hasil | Bagian Sertifikasi | Hasil Uji Kompetensi + surat hasil + **info hak banding & keluhan**, Banding Asesmen | Keputusan K/BK + link surat | Log L7 |
| 8 Penyerahan Sertifikat | Bagian Administrasi | Tracer Sertifikat (Diajukan ke BNSP → Siap Diambil → Sudah Diserahkan) | No. sertifikat + nama penerima (tanda terima) | Log L8 |
| 9 Penanganan Keluhan | Bagian Manajemen Mutu | Formulir keluhan + nomor tiket, Lacak Tiket | Tindak lanjut + tanggapan ke pelapor | Sheet `Keluhan`, log L9 |
| 10 Pengendalian Rekaman | Sekretariat LSP | — | Rekaman & Log (filter per langkah, ekspor CSV), **Cetak rekaman per peserta** | Sheet `Log` |

Layanan tambahan yang mengikuti layanan digital LSP UNS: **Surveilans**, **Legalisir Sertifikat**, **Perpanjangan (RCC)**, dan **Survei Kepuasan** (menjawab tujuan SOP: meningkatkan kepuasan pemohon).

---

## 2. Struktur repositori

```
index.html              ← layanan publik (asesi)
admin.html              ← panel admin (login)
assets/css/style.css
assets/js/config.js     ← ISI API_URL di sini
assets/js/core.js       ← API, utilitas, data SOP
assets/js/public.js     ← halaman publik
assets/js/admin.js      ← panel admin
assets/js/mock.js       ← mode demo (aktif bila API_URL kosong)
assets/img/logo.svg     ← ganti dengan logo resmi LSP
backend/Code.gs         ← tempel ke Apps Script
backend/appsscript.json ← manifest (opsional)
```

---

## 3. Memasang backend (Excel → Google Sheets → Apps Script)

1. Unggah `sheets/Database-SIPINTAR-LSP-UNIMED.xlsx` ke Google Drive. Klik kanan → **Buka dengan → Google Spreadsheet**, lalu **File → Simpan sebagai Google Spreadsheet**.
2. Lengkapi sel berwarna kuning:
   - **Skema**: kode, nama resmi 16 skema, jumlah unit, dan **persyaratan khusus tiap skema** (satu per baris).
   - **Jadwal**: 16 jadwal untuk **17 Oktober 2026** sudah disiapkan. Periksa batas daftar dan TUK. Kuota boleh diisi untuk kontrol internal; kuota tidak ditampilkan ke publik.
   - **TUK**, **Asesor**, **Pengaturan** (nomor lisensi, email resmi, telepon).
   - **Dokumen**: link formulir umum dan APL-02 per skema (kolom `id_skema`).
3. Di spreadsheet tersebut buka **Ekstensi → Apps Script**. Tempel `backend/Code.gs`, simpan. *(Opsional)* tampilkan file manifes lalu ganti dengan `backend/appsscript.json`.
4. Jalankan **`setup()`** sekali dan beri izin (Spreadsheet, Drive, kirim email). Password akun **admin** muncul di Log eksekusi.
5. **Terapkan → Deployment baru → Aplikasi web** — Jalankan sebagai: **Saya**, Akses: **Siapa saja**. Salin URL `/exec` ke `assets/js/config.js`.

### Nomor registrasi & bukti pendaftaran

1. Calon asesi mengisi formulir dan menekan **Kirim permohonan**.
2. Apps Script mengunci proses, memeriksa jadwal dan NIK ganda, lalu membuat nomor urut otomatis `LSPU-YYMM-0001` dan menyimpan baris ke sheet **Pendaftaran** serta berkas ke Drive.
3. Nomor registrasi langsung tampil di layar beserta ringkasan pendaftaran, tombol **Cetak / simpan PDF bukti**, dan salin nomor.
4. Bila `kirim_email = YA`, **bukti pendaftaran dikirim ke email** asesi. Email berikutnya terkirim otomatis saat verifikasi (L3), penjadwalan (L4), hasil (L7), dan sertifikat siap diambil (L8).
5. Asesi dapat mencetak ulang bukti kapan saja di menu **Status permohonan** (No. Registrasi + email).

Kuota email harian Apps Script terbatas (akun Google Workspace lebih besar daripada akun Gmail biasa). Jika kuota habis, pendaftaran tetap tersimpan dan nomor tetap tampil di layar.

## 4. Memasang frontend (GitHub Pages)

1. Buka `assets/js/config.js`, lalu isi `API_URL: 'https://script.google.com/macros/s/XXXX/exec'`.
2. Ganti `assets/img/logo.svg` dengan logo resmi. Bila logo berformat PNG, sesuaikan `LOGO_URL`.
3. Push ke GitHub. Buka **Settings → Pages → Deploy from a branch → `main` / root**.
4. Situs akan aktif di `https://<user>.github.io/<repo>/`. Panel admin ada di `/admin.html`.

**Mode demo**: selama `API_URL` kosong, situs memakai data contoh yang hanya tersimpan di browser (akun demo: `admin` / `demo12345`). Mode ini cocok untuk mencoba tampilan dan alur sebelum backend siap.

## 5. Pengisian data awal (sebelum penyaksian)

1. Login ke `admin.html`, lalu **ganti password**.
2. **Pengaturan**: isi nama LSP, nomor lisensi BNSP, alamat, email, telepon, jam layanan, pengumuman, dan link template APL-02.
3. **Skema**: hapus skema contoh, lalu masukkan skema resmi (kode, unit, persyaratan, biaya, link dokumen skema).
4. **TUK** dan **Asesor**: isi kolom *skema* asesor dengan ID skema, misalnya `SKM-001,SKM-002`, supaya plotting hanya menawarkan asesor yang sesuai.
5. **Jadwal**: buat jadwal berstatus *Dibuka* dengan kuota dan batas daftar.
6. **Dokumen Mutu**: isi link Drive (akses *siapa saja yang memiliki link*) untuk SOP, APL-01, APL-02, dan panduan.
7. **Pengguna**: buat akun per peran SOP (Sekretariat LSP, Bagian Administrasi, Bagian Sertifikasi, Bagian Manajemen Mutu).

## 6. Hak akses per peran

| Aksi | Admin | Sekretariat | Bag. Administrasi | Bag. Sertifikasi | Bag. Manajemen Mutu |
|---|---|---|---|---|---|
| Ubah data master | ✓ | ✓ | – | – | – |
| Hapus data master, kelola pengguna | ✓ | – | – | – | – |
| L2 koreksi data | ✓ | ✓ | ✓ | – | – |
| L3 verifikasi, L4 plotting, L6 pelaksanaan, L7 hasil | ✓ | – | – | ✓ | – |
| L5 administrasi asesmen | ✓ | ✓ | – | ✓ | – |
| L8 sertifikat | ✓ | – | ✓ | – | – |
| L9 tindak lanjut keluhan | ✓ | – | – | – | ✓ |
| Lihat semua data & rekaman | ✓ | ✓ | ✓ | ✓ | ✓ |

## 7. Keamanan & kerahasiaan data

- Peserta hanya bisa melihat datanya dengan **No. Registrasi + email**. Di sisi publik, NIK disamarkan dan nama di halaman plotting juga disamarkan.
- Password admin disimpan sebagai hash SHA-256 bergaram. Login dikunci 10 menit setelah 5 kali gagal, dan sesi berlaku 6 jam.
- Berkas unggahan masuk ke folder Drive **`SIPINTAR_UPLOADS/<No.Reg>/`** dan **tidak dibagikan publik**. Agar admin lain bisa membuka tautan berkas dari panel, bagikan folder tersebut ke akun Google mereka.
- Link **surat hasil** dan **dokumen mutu** harus diatur *siapa saja yang memiliki link* agar dapat dibuka peserta.
- Batas unggahan per berkas 2 MB (PDF/JPG/PNG). Ubah `MAX_FILE_MB` di `Code.gs` dan `config.js` jika perlu.

## 8. Skenario demonstrasi saat penyaksian BNSP

1. **Alur Layanan (SOP)**: tunjukkan 10 langkah beserta PJ dan fitur pendukungnya.
2. Asesi mendaftar di **Jadwal & Registrasi**, lalu menerima No. Registrasi (L2).
3. Admin Bag. Sertifikasi memverifikasi (L3), lalu melakukan plotting asesor + TUK (L4). Hasilnya langsung tampil di halaman **Plotting** dan **Status** asesi.
4. Sekretariat mengisi status dokumen asesmen (L5), lalu kehadiran dicatat (L6).
5. Keputusan K/BK dan surat hasil diinput (L7). Halaman **Hasil** asesi menampilkan info hak banding.
6. Sertifikat ditandai *Siap Diambil*, lalu *Sudah Diserahkan* beserta nama penerima (L8).
7. Simulasikan **keluhan**, lalu tindak lanjuti oleh Manajemen Mutu (L9) dan tunjukkan tanggapannya di **Lacak Tiket**.
8. Buka **Rekaman & Log**, filter per langkah, lalu **Cetak rekaman** satu peserta sebagai bukti mampu telusur (L10).

## 9. Pemeliharaan

- **Cadangan**: spreadsheet → *File → Buat salinan* secara berkala. Riwayat versi Google Sheets juga tersedia.
- Bila ada pembaruan `Code.gs` yang menambah kolom, jalankan `setup()` lagi. Fungsi ini hanya menambah kolom atau sheet yang belum ada dan tidak menimpa data.
- Admin bisa mengedit langsung di spreadsheet. Pertahankan baris judul (baris 1) dan format kolom teks.
