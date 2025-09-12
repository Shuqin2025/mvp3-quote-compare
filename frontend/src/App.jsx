// frontend/src/App.jsx —— 直接整文件替换
import React, { useMemo, useRef, useState } from 'react';

/** 读取 ?api= 覆盖后端地址 */
function useApiBase() {
  return useMemo(() => {
    try {
      const u = new URL(window.location.href);
      const override = u.searchParams.get('api');
      const base = (override || '').trim() || 'http://localhost:8080'; // fallback 本地
      console.info('[mvp3] App loaded. API_BASE =', base);
      return base.replace(/\/$/, '');
    } catch {
      return 'http://localhost:8080';
    }
  }, []);
}

export default function App() {
  const API_BASE = useApiBase();
  const urlInput = useRef(null);

  const [list, setList] = useState([]);
  const [stat, setStat] = useState({ ok: false, count: 0 });
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);

  async function onFetch() {
    const pageUrl = (urlInput.current?.value || '').trim();
    if (!pageUrl) return alert('请输入目录页 URL');

    setLoading(true);
    setList([]);
    setStat({ ok: false, count: 0 });

    try {
      const qs = new URLSearchParams({ url: pageUrl, limit: String(limit) });
      const resp = await fetch(`${API_BASE}/v1/api/catalog/parse?${qs.toString()}`);
      const data = await resp.json();

      const items = Array.isArray(data.items) ? data.items : [];
      setList(items);
      setStat({ ok: true, count: data.count ?? items.length });

      if (!Array.isArray(data.items)) {
        alert('抓取失败：响应格式不正确，items 不是数组。');
      }
    } catch (e) {
      console.error('[mvp3] fetch error:', e);
      alert('抓取失败：网络或服务异常。');
    } finally {
      setLoading(false);
    }
  }

  /** 导出 .xlsx（不含内嵌图片，后续可再加内嵌） */
  async function onExportXlsx() {
    if (!list.length) return alert('没有可导出的数据');
    // 动态引入 SheetJS 以减小首屏
    const XLSX = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js')
      .then(m => (m.default || window.XLSX));

    const rows = [
      ['Item No.', 'Picture', 'Description', 'MOQ', 'Unit Price', 'Link'],
      ...list.map(x => [
        x.sku || '',
        x.img || '',
        x.title || '',
        x.moq || '',
        x.price ? `${x.price}${x.currency || ''}` : '',
        x.url || ''
      ])
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'catalog');
    XLSX.writeFile(wb, `catalog-preview-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'')}.xlsx`);
  }

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1>MVP3 — App</h1>

      <div style={{ background: '#e8f5e9', padding: 12, borderRadius: 6, marginBottom: 12 }}>
        这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。
      </div>

      <div style={{ background: '#fff3e0', padding: 12, borderRadius: 6, marginBottom: 12 }}>
        抓取成功：共 {stat.count} 条（预览前 {limit} 条）
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          ref={urlInput}
          style={{ flex: 1, padding: 8 }}
          placeholder="粘贴要抓取的目录页 URL（例如某电商分类页）"
          defaultValue=""
        />
        <button onClick={onFetch} disabled={loading} style={{ padding: '8px 12px' }}>
          {loading ? '抓取中…' : '抓取目录'}
        </button>
        <select value={limit} onChange={e => setLimit(parseInt(e.target.value, 10) || 50)}>
          {[50, 100].map(n => <option key={n} value={n}>预览（前 {n} 条）</option>)}
        </select>
        <button onClick={onExportXlsx} disabled={!list.length} style={{ padding: '8px 12px' }}>
          导出 Excel（.xlsx）
        </button>
      </div>

      <div style={{
        minHeight: 260, background:
          'repeating-linear-gradient(45deg,#fafafa,#fafafa 10px,#f3f3f3 10px,#f3f3f3 20px)',
        borderRadius: 8, padding: 12
      }}>
        {!list.length ? (
          <em>（占位区域：后续将展示抓取返回的 JSON 简要预览，或转换成表格的展示。）</em>
        ) : (
          <table width="100%" cellPadding="6" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f6f6f6' }}>
                <th align="left">Item No.</th>
                <th align="left">Picture</th>
                <th align="left">Description</th>
                <th align="left">MOQ</th>
                <th align="left">Unit Price</th>
                <th align="left">Link</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x, i) => (
                <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                  <td>{x.sku || ''}</td>
                  <td>{x.img ? <img alt="" src={x.img} style={{ width: 80, height: 80, objectFit: 'contain' }} /> : ''}</td>
                  <td>{x.title || ''}</td>
                  <td>{x.moq || ''}</td>
                  <td>{x.price ? `${x.price}${x.currency || ''}` : ''}</td>
                  <td>{x.url ? <a href={x.url} target="_blank" rel="noreferrer">链接</a> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 12, color: '#888' }}>
        © MVP3 — 页面骨架（占位版）。确认部署稳定后，将逐步接回业务逻辑。
      </div>
    </div>
  );
}
