// /src/App.jsx
import React, { useMemo, useState } from 'react';
import ExportButton from '../frontend/components/ExportButton.jsx';
import { getApiBase, imageProxy } from '../export-xlsx.js';

function toastInfo(msg, ms = 2400) {
  try {
    if (typeof window !== 'undefined' && typeof window.toast === 'function') { window.toast(msg); return; }
    let bar = document.getElementById('__toast__');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = '__toast__';
      bar.style.cssText = 'position:fixed;right:16px;top:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(bar);
    }
    const item = document.createElement('div');
    item.textContent = msg;
    item.style.cssText = 'background:rgba(17,24,39,.92);color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.15);font-size:14px;max-width:360px;';
    bar.appendChild(item);
    setTimeout(() => { item.style.opacity = '0'; item.style.transition = 'opacity .3s'; }, ms);
    setTimeout(() => item.remove(), ms + 320);
  } catch { alert(msg); }
}

const i18nText = {
  zh: {
    title: '云贸星 · 智能表格生成器（React）',
    hint: '输入目录型网页链接，秒生成 Excel 产品表格。',
    inputPh: '粘贴要抓取的目录页 URL（例如某电商分类页）',
    fetch: '抓取目录',
    preview: '预览（前 %n 条）',
    export: '导出 Excel（.xlsx）',
    fetched: '抓取成功：共 %n 条（预览前 %m 条）',
    failed: '抓取失败：响应格式不正确，items 不是数组。',
    link: '链接', notCatalog: '该页面不是商品目录，请打开具体分类页再试'
  },
  en: {
    title: 'Yunivera · Table Maker (React)',
    hint: 'Paste a category/list URL to export product table.',
    inputPh: 'Paste a category URL (e.g., shop category)',
    fetch: 'Fetch',
    preview: 'Preview (first %n)',
    export: 'Export (.xlsx)',
    fetched: 'Fetched: %n items (showing %m).',
    failed: 'Fetch failed: unexpected format, items is not an array.',
    link: 'Open'
  },
  de: {
    title: 'Yunivera · Tabellengenerator (React)',
    hint: 'Fügen Sie eine Katalog-/Listen-URL ein.',
    inputPh: 'Kategorie-URL einfügen (z. B. Shop-Kategorie)',
    fetch: 'Abrufen',
    preview: 'Vorschau (erste %n)',
    export: 'Export (.xlsx)',
    fetched: 'Erfolg: Insgesamt %n Einträge (zeige %m).',
    failed: 'Fehler: Unerwartetes Antwortformat – items ist kein Array.',
    link: 'Link', notCatalog: 'Diese Seite ist kein Produktkatalog. Bitte öffnen Sie eine konkrete Kategorieseite und versuchen Sie es erneut.'
  }
};

function useLang() {
  const [lang, setLang] = useState(localStorage.getItem('mvp_lang') || 'zh');
  const t = useMemo(() => i18nText[lang] || i18nText.zh, [lang]);
  const apiLang = useMemo(() => (lang === 'de' ? 'de' : lang === 'en' ? 'en' : 'zh'), [lang]);
  const set = (l) => { localStorage.setItem('mvp_lang', l); setLang(l); };
  return { lang, t, setLang: set, apiLang };
}

export default function App() {
  const { t, setLang, apiLang } = useLang();
  const [apiBase] = useState(getApiBase());
  const [url, setUrl] = useState('https://www.s-impuls-shop.de/catalog/home-cinema/audio-kabel');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);

  async function fetchList() {
    if (!apiBase) { toastInfo('缺少 API 地址，请用 ?api= 或 <meta name="api-base"> 指定'); return; }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ url, limit: String(limit) });
      const resp = await fetch(`${apiBase}/catalog/parse?${qs.toString()}`, {
        method: 'GET',
        headers: { 'X-Lang': apiLang },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const items = data?.items || data?.rows || data?.data || data?.list || [];
      if (!Array.isArray(items)) throw new Error('items_not_array');
      setList(items);
      toastInfo(t.fetched.replace('%n', items.length).replace('%m', Math.min(limit, items.length || limit)));
    } catch (e) {
      console.error('[mvp] fetch error:', e);
      toastInfo(t.failed);
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div id="langSwitcher">
        <button onClick={() => setLang('zh')}>CN 中文</button>
        <button onClick={() => setLang('de')}>DE Deutsch</button>
        <button onClick={() => setLang('en')}>GB English</button>
      </div>
      <h1>{t.title}</h1>

      <div className="tool-row">
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste a category URL" />
        <button className="btn primary" disabled={loading} onClick={fetchList}>
          {loading ? '抓取中…' : '抓取目录'}
        </button>
        <select value={limit} onChange={e => setLimit(parseInt(e.target.value, 10))}>
          {[50,100,150,200,300,500].map(n => <option value={n} key={n}>{`预览（前 ${n} 条）`}</option>)}
        </select>
        <ExportButton items={list} />
      </div>

      <div className="placeholder">
        {list.length > 0 && (
          <table className="grid">
            <thead>
              <tr>
                <th>#</th><th>Item No.</th><th>Picture</th><th>Description</th><th>MOQ</th><th>Unit Price</th><th>Link</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, limit).map((it, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>{it.sku || it.code || it.id || ''}</td>
                  <td>{it.img ? <img src={imageProxy(it.img,'raw')} alt="" style={{ width: 72, height: 48, objectFit: 'contain' }} /> : null}</td>
                  <td>{it.title || it.name || it.desc || ''}</td>
                  <td>{it.moq || '—'}</td>
                  <td>{it.price ? `${it.price}${it.currency || ''}` : '—'}</td>
                  <td><a href={it.url || it.link} target="_blank" rel="noreferrer">Open</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
