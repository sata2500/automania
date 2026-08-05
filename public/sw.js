// Service Worker for Automania-Next
const CACHE_NAME = 'automania-next-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let network handle request naturally
  return;
});
