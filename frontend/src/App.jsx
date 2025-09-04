// frontend/src/App.jsx
import { useMemo, useState } from 'react';

const API =
  (import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || '')
    .replace(/\/$/, '') ||
  'https://yunivera-mvp2.onrender.com/v1/api';

// 一键开关：是否应用站点特例规则（1688/Amazon/…）
// 以后需要再开，把 false 改成 true 即可
const ENABLE_SITE_RULES = false;

export default function App() {
  const [title, setTitle] = useState('Example Domain');
  const [body, setBody] = useState(sampleBody());
  const [url, setUrl] = useState('https://example.com');
  const [scrapeJson, setScrapeJson] = useState('');
  const [ping, setPing] = useState('');
  const [busy, setBusy] = useState(false);

  const api = useMemo(() => API, []);

  async function backendCheck() {
    try {
      const res = await fetch(`${api}/health`);
      const j = await res.json();
      setPing(`[PING] ${res.status} ${res.ok ? 'OK' : 'ERR'} | ${JSON.stringify(j)}`);
    } catch (e) {
      setPing(`[PING] ERR: ${String(e)}`);
    }
  }

  async function doScrape() {
    setBusy(true);
    setScrapeJson('');
    try {
      const r = await fetch(`${api}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const j = await r.json();

      // 可选：在前端做一次轻量“站点特例解析”
      const host = safeHost(url);
      const siteHints = ENABLE_SITE_RULES ? extractBySite(host, j.preview || '') : {};

      setScrapeJson(JSON.stringify({ ok: r.ok, ...j, siteHints }, null, 2));
    } catch (e) {
      setScrapeJson(JSON.stringify({ ok: false, error: String(e) }, null, 2));
    } finally {
      setBusy(false);
    }
  }

  async function genPDF() {
    setBusy(true);
    try {
      const res = await fetch(`${api}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 这里只发 title + body；当你未来要发表格时，传 rows 即可：
        // body: JSON.stringify({ title, rows: [{ sku:'A', title:'Item A', price: 10, currency:'EUR', url:'https://...' }] })
        body: JSON.stringify({ title, content: body }),
      });

      if (!res.ok || !res.headers.get('content-type')?.includes('application/pdf')) {
        // 尝试拿错误 JSON
        let j = null;
        try { j = await res.json(); } catch {}
        alert(`PDF 失败：HTTP ${res.status} ${JSON.stringify(j || {})}`);
        return;
      }

      // 下载/打开 PDF
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      alert(`PDF 失败：${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h2>MVP3：Scrapen + Ausfüllen + PDF erzeugen</h2>

      <div style={{ margin: '12px 0' }}>
        <label>标题 / Titel：</label><br />
        <input
          style={{ width: '100%', padding: 8 }}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="例如：测试报价单 / Testangebot"
        />
      </div>

      <div style={{ margin: '12px 0' }}>
        <label>正文 / Text：</label><br />
        <textarea
          style={{ width: '100%', height: 220, padding: 8, lineHeight: 1.5 }}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="在此输入或使用下方『回填/智能回填/目录抓取』自动生成"
        />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <button onClick={backendCheck}>后端健康检查 / Backend-Check</button>
        <button onClick={genPDF} disabled={busy}>生成 PDF / PDF erzeugen</button>
        <span style={{ color: '#666' }}>{ping}</span>
      </div>

      <hr />

      <h3>🔎 Web-Scraping & 一键回填</h3>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ flex: 1, padding: 8 }}
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://example.com"
        />
        <button onClick={doScrape} disabled={busy}>抓取 / Scrapen</button>
      </div>
      <textarea
        style={{ width: '100%', height: 200, marginTop: 8, padding: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
        value={scrapeJson}
        onChange={() => {}}
      />

      <p style={{ marginTop: 16, color: '#999', fontSize: 13 }}>
        API 基址 / API-Base：<code>{api}</code>
      </p>
    </div>
  );
}


/* ============ Helpers ============ */

// 轻量“站点特例”解析（默认关闭）
function extractBySite(host, text) {
  // 你的项目里如需恢复 1688/Amazon 等规则，可在此按 host 编写：
  // if (/1688\.com$/.test(host)) { ... }
  // if (/amazon\./.test(host)) { ... }
  // 为了稳定，这里默认返回空对象
  return {};
}

function safeHost(u) {
  try { return new URL(u).hostname || ''; } catch { return ''; }
}

function sampleBody() {
  return [
    '【基本信息】',
    '名称：Example Domain',
    'SKU：（未识别）',
    '价格：（未识别）',
    'MOQ：（未识别）',
    '来源：https://example.com',
    '',
    '【备注】',
    '1）上方为自动识别结果，仅供初审；请以卖家/供应商实际报价为准；',
    '2）如需我们匹配等效/替代款，或批量比价，请直接回复链接。',
    '',
    '【DE | Basisinfo】',
    'Name: Example Domain',
    'SKU: (n/a)',
    'Preis: (unbekannt)',
    'MOQ: (n/a)',
    'Quelle: https://example.com',
    'Hinweis:',
    '1) Obige Werte sind automatisch extrahiert. Bitte Angebot des Anbieters prüfen.',
    '2) Für Alternativen / Preisvergleiche antworten Sie gern mit dem Link.',
  ].join('\n');
}
