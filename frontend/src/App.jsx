// frontend/src/App.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

// 从预览地址 ?api=... 读取后端基址
function getApiBase() {
  const u = new URL(window.location.href);
  const v = u.searchParams.get('api');
  return v ? v.replace(/\/+$/, '') : '';
}

const API_BASE = getApiBase();

export default function App() {
  const [url, setUrl] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);

  // 预览里用图片代理，避免该站 CORS/防盗链
  const proxiedImg = (raw) =>
    `${API_BASE}/v1/api/img?src=${encodeURIComponent(raw)}`;

  async function fetchList() {
    if (!url) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ url, limit: String(limit) }).toString();
      const resp = await fetch(`${API_BASE}/v1/api/catalog/parse?${qs}`, {
        headers: { 'x-lang': localStorage.getItem('mvp3.lang') || 'zh' },
      });
      const data = await resp.json();

      if (!Array.isArray(data?.items)) {
        throw new Error('响应格式不正确，items 不是数组。');
      }
      setRows(data.items);
      ui.toast(`抓取成功：共 ${data.items.length} 条`);
    } catch (e) {
      console.error('[mvp3] fetch error:', e);
      ui.alert(`抓取失败：${e.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  function exportXlsx() {
    if (!rows.length) {
      ui.alert('没有可导出的数据');
      return;
    }
    const wsData = [
      ['Item No.', 'Picture', 'Description', 'MOQ', 'Unit Price', 'Link'],
      ...rows.map((r) => [
        r.sku || '',
        // 先导出为“图片链接”；Excel 内嵌真实图片需要改用 exceljs，见文末“下一步”
        r.img ? `=HYPERLINK("${r.img}","Bild")` : '',
        r.title || '',
        r.moq || '',
        r.price ? `${r.price}${r.currency || ''}` : '',
        r.url ? `=HYPERLINK("${r.url}","链接")` : '',
      ]),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'catalog');
    const fname = `catalog-preview-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[-:T]/g, '')}.xlsx`;
    XLSX.writeFile(wb, fname);
  }

  useEffect(() => {
    console.log('[mvp3] App loaded. API_BASE =', API_BASE || '(empty)');
  }, []);

  return (
    <div>
      <h2>MVP3 — App</h2>

      <div className="tip ok">
        这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。
      </div>

      <div className="tip warn">
        抓取成功：共 {rows.length} 条（预览前 {limit} 条）
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          style={{ flex: 1 }}
          placeholder="粘贴要抓取的目录页 URL（例如某电商分类页）"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="primary" onClick={fetchList} disabled={loading}>
          {loading ? '抓取中…' : '抓取目录'}
        </button>

        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          {[50, 100, 200, 300, 500].map((n) => (
            <option key={n} value={n}>
              预览（前 {n} 条）
            </option>
          ))}
        </select>

        <button onClick={exportXlsx}>导出 Excel（.xlsx）</button>
      </div>

      <div className="preview">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 150 }}>Item No.</th>
              <th style={{ width: 120 }}>Picture</th>
              <th>Description</th>
              <th style={{ width: 90 }}>MOQ</th>
              <th style={{ width: 120 }}>Unit Price</th>
              <th style={{ width: 120 }}>Link</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.sku}</td>
                <td>
                  {r.img ? (
                    <img
                      src={proxiedImg(r.img)}
                      alt={r.sku}
                      style={{
                        width: 80,
                        height: 80,
                        objectFit: 'contain',
                        background: '#fff',
                        border: '1px solid #eee',
                      }}
                      loading="lazy"
                    />
                  ) : (
                    ''
                  )}
                </td>
                <td>{r.title}</td>
                <td>{r.moq || '—'}</td>
                <td>
                  {r.price ? (
                    <>
                      {r.price}
                      {r.currency || ''}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer">
                      链接
                    </a>
                  ) : (
                    ''
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} style={{ color: '#999' }}>
                  （占位区域：后续将展示抓取返回的 JSON 简要预览，或转换成表格的展示。）
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
