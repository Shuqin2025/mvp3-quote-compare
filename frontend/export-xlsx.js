// frontend/export-xlsx.js
// ESM module. Provides a single source of truth for calling the backend
// and a tiny helper for the image proxy.

/**
 * Get API base from <meta name="api-base" content="..."> or window.API_BASE.
 * Fallback to relative /v1/api so it also works in local preview.
 */
export function getApiBase() {
  try {
    const el = document.querySelector('meta[name="api-base"]');
    if (el && el.content) return el.content.replace(/\/+$/, '');
  } catch (_) {}
  if (typeof window !== 'undefined' && window.API_BASE) {
    return String(window.API_BASE).replace(/\/+$/, '');
  }
  // final fallback
  return '/v1/api';
}

/**
 * Build the image proxy URL (format = "raw" | "file")
 * @param {string} originalUrl - The original image url
 * @param {("raw"|"file")} format - Output format (default: "raw")
 */
export function imageProxy(originalUrl, format = 'raw') {
  const api = getApiBase();
  const u = new URL(api + '/image', location.origin);
  u.searchParams.set('format', format);
  u.searchParams.set('url', originalUrl);
  return u.toString();
}

/**
 * POST an array of catalog rows and return a Blob (.xlsx).
 * Each item in `items` should already be normalized for the backend.
 * @param {Array<object>} items
 * @param {{withImages?: boolean, filename?: string}} options
 */
export async function exportToXlsx(items, options = {}) {
  const { withImages = true, filename = 'catalog.xlsx' } = options;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No items to export.');
  }
  const api = getApiBase();
  const url = api + '/export-xlsx';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, withImages })
  });

  if (!res.ok) {
    const text = await safeText(res);
    throw new Error(`Export failed (${res.status}): ${text}`);
  }

  const blob = await res.blob();
  triggerDownload(blob, filename);
  return blob;
}

/**
 * Export by letting the backend crawl a page URL directly.
 * @param {string} pageUrl - The catalog page url to crawl
 * @param {{limit?: number, withImages?: boolean, filename?: string}} options
 */
export async function exportToXlsxFromUrl(pageUrl, options = {}) {
  const { limit = 50, withImages = true, filename = 'catalog.xlsx' } = options;
  if (!pageUrl) throw new Error('pageUrl is required.');

  const api = getApiBase();
  const u = new URL(api + '/export-xlsx', location.origin);
  u.searchParams.set('url', pageUrl);
  if (limit != null) u.searchParams.set('limit', String(limit));
  if (withImages) u.searchParams.set('withImages', '1');

  const res = await fetch(u.toString(), { method: 'GET' });
  if (!res.ok) {
    const text = await safeText(res);
    throw new Error(`Export (by url) failed (${res.status}): ${text}`);
  }
  const blob = await res.blob();
  triggerDownload(blob, filename);
  return blob;
}

// ---- helpers ---------------------------------------------------------------

async function safeText(res) {
  try { return await res.text(); } catch { return '<no body>'; }
}

function triggerDownload(blob, filename) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename || 'catalog.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// default export kept for convenience in plain <script type="module">
export default {
  getApiBase,
  imageProxy,
  exportToXlsx,
  exportToXlsxFromUrl
};
