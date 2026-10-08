/**
 * KONFIGURASI SIPINTAR LSP UNIMED
 * Setelah Apps Script di-deploy sebagai Aplikasi Web, tempel URL /exec di API_URL.
 * Jika API_URL kosong, situs berjalan dalam MODE DEMO (data contoh di browser, tidak tersimpan).
 */
window.SIPINTAR_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbzEeNWL1N_702QjGzN4c9rJielGHGFya557i8GyiVHoOhDQw_3_NVX-Db7KV-02pMKWlQ/exec',
  NAMA_APLIKASI: 'SIPINTAR',
  NAMA_LSP: 'LSP UNIMED',
  LOGO_URL: 'assets/img/favicon-192.png',   // lambang LSP UNIMED (header & sidebar)
  LOGO_FULL: 'assets/img/logo-lsp.png',     // logo lengkap LSP UNIMED (beranda, login, bukti daftar)
  MAX_FILE_MB: 2
};
