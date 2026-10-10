/* SIPINTAR LSP UNIMED — service worker (app shell cache, aman untuk GitHub Pages).
 * Versi cache: naikkan CACHE saat rilis agar aplikasi terinstal ikut diperbarui.
 * Catatan: permintaan ke Apps Script (script.google.com) TIDAK di-cache,
 * selalu lewat jaringan supaya data sertifikasi tetap segar.
 */
const CACHE = 'sipintar-v6';
const CORE = [
  './',
  './index.html',
  './admin.html',
  './manifest.webmanifest',
  './assets/css/style.css?v=20261010d',
  './assets/js/config.js?v=20261010d',
  './assets/js/seed-data.js?v=20261010d',
  './assets/js/mock.js?v=20261010d',
  './assets/js/core.js?v=20261010d',
  './assets/js/public.js?v=20261010d',
  './assets/js/admin.js?v=20261010d',
  './assets/img/favicon-192.png',
  './assets/img/favicon-512.png',
  './assets/img/logo-lsp.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Hanya permintaan GET yang ditangani; POST ke Apps Script (login, pendaftaran, data) selalu langsung ke jaringan.
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // API Apps Script + Google Fonts: selalu jaringan dulu, fallback cache.
  if (url.hostname.includes('script.google') || url.hostname.includes('fonts.g')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // Navigasi halaman: jaringan dulu, offline fallback ke index.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('./index.html')));
    return;
  }
  // Aset statis: cache dulu, jaringan sebagai pembaruan.
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
