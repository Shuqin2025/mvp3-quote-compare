import React, { useMemo, useState } from 'react';
import axios from 'axios';
import ExportButton from './ExportButton';

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

function readApiBase() {
  const u = new URL(window.location.href);
  const api = u.searchParams.get('api');
  return api ? api.replace(/\/+$/, '') : '';
}
const API_BASE = readApiBase();

const i18nText = {
  zh: {
    title: 'MVP3 — App',
    hint: '这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。',
    inputPh: '粘贴要抓取的目录页 URL（例如某电商分类页）',
    fetch: '抓取目录',
    preview: '预览（前 %n 条）',
    export: '导出 Excel（.xlsx）',
    fetched: '抓取成功：共 %n 条（预览前 %m 条）',
    failed: '抓取失败：响应格式不正确，items 不是数组。',
    link: '链接', notCatalog: '该页面不是商品目录，请打开具体分类页再试'
  },
  de: {
    title: 'MVP3 — App',
    hint: 'Dies ist ein Platzhalter ohne Logik, um die Stabilität der Bereitstellung zu prüfen.',
    inputPh: 'Kategorie-URL einfügen (z. B. Shop-Kategorie)',
    fetch: 'Katalog abrufen',
    preview: 'Vorschau (erste %n)',
    export: 'Excel exportieren (.xlsx)',
    fetched: 'Erfolg: Insgesamt %n Einträge (zeige %m).',
    failed: 'Fehler: Unerwartetes Antwortformat – items ist kein Array.',
    link: 'Link', notCatalog: 'Diese Seite ist kein Produktkatalog. Bitte öffnen Sie eine konkrete Kategorieseite und versuchen Sie es erneut.'
  },
  en: {
    title: 'MVP3 — App',
    hint: 'Placeholder page (no logic) only to validate deployment stability.',
    inputPh: 'Paste a category URL (e.g., shop category)',
    fetch: 'Fetch catalog',
    preview: 'Preview (first %n)',
    export: 'Export Excel (.xlsx)',
    fetched: 'Fetched: %n items (showing %m).',
    failed: 'Fetch failed: unexpected format, items is not an array.',
    link: 'Link'
  },
};

function useLang() {
  const [lang, setLang] = useState(localStorage.getItem('mvp3_lang') || 'zh');
  const t = useMemo(() => i18nText[lang] || i18nText.zh, [lang]);
  const apiLang = useMemo(() => (lang === 'de' ? 'de' : lang === 'en' ? 'en' : 'zh'), [lang]);
  const set = (l) => { localStorage.setItem('mvp3_lang', l); setLang(l); };
  return { lang, t, setLang: set, apiLang };
}

export default function App() {
  const { lang, t, setLang, apiLang } = useLang();
  const [url, setUrl] = useState('https://www.s-impuls-shop.de/catalog/home-cinema/audio-kabel');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);

  async function fetchList() {
    if (!API_BASE) {
      alert('缺少 ?api= 后端地址参数，例如：?api=https://<你的-mvp2-backend>.onrender.com');
      return;
    }
    setLoading(true);
    try {
      const resp = await axios.get(`${API_BASE}/v1/api/catalog/parse`, {
        params: { url, limit },
        headers: { 'X-Lang': apiLang },
      });
      const items = resp?.data?.items;
      const adapter = resp?.data?.adapter || resp?.data?.type;
      if ((adapter === 'generic-links' || adapter === 'GenericLinks') && (!Array.isArray(items) || items.length === 0)) {
        toastInfo(t.notCatalog);
        setList([]);
        return;
      }
      if (!Array.isArray(items)) throw new Error('items_not_array');
      setList(items);
    } catch (e) {
      console.error('[mvp3] fetch error:', e);
      toastInfo(t.failed);
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  function Langs() {
    return (
      <div id="langSwitcher">
        <button onClick={() => setLang('zh')}>CN 中文</button>
        <button onClick={() => setLang('de')}>DE Deutsch</button>
        <button onClick={() => setLang('en')}>GB English</button>
      </div>
    );
  }

  return (
    <div className="container">
      <Langs />
      <h1>{t.title}</h1>
      <div className="alert alert-green">{t.hint}</div>
      <div className="alert alert-amber">
        {t.fetched.replace('%n', list.length).replace('%m', Math.min(limit, list.length || limit))}
      </div>

      <div className="tool-row">
        <input
          className="url-input"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder={t.inputPh}
        />
        <button className="btn primary" disabled={loading} onClick={fetchList}>
          {loading ? '抓取中…' : t.fetch}
        </button>
        <select value={limit} onChange={e => setLimit(parseInt(e.target.value, 10))}>
          {[50, 100, 150, 200, 300, 500].map(n => <option value={n} key={n}>{t.preview.replace('%n', n)}</option>)}
        </select>
        <ExportButton items={list} apiBase={API_BASE} toast={toastInfo} />
      </div>

      <div className="placeholder">
        {list.length > 0 && (
          <table className="grid">
            <thead>
              <tr>
                <th>#</th>
                <th>Item No.</th>
                <th>Picture</th>
                <th>Description</th>
                <th>MOQ</th>
                <th>Unit Price</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, limit).map((it, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>{it.sku}</td>
                  <td>
                    {it.img ? <img src={it.img} alt="" style={{ width: 72, height: 48, objectFit: 'contain' }} /> : null}
                  </td>
                  <td>{it.title}</td>
                  <td>{it.moq || '—'}</td>
                  <td>{it.price ? `${it.price}${it.currency || ''}` : '—'}</td>
                  <td><a href={it.url} target="_blank" rel="noreferrer">链接</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <footer className="ft">© MVP3 — 页面骨架（占位版）。确认部署稳定后，将逐步接回业务逻辑。</footer>
    </div>
  );
}
