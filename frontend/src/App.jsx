import React, { useMemo, useRef, useState } from 'react';

/**
 * MVP3 — App.jsx
 * 适配后端返回 { ok, source, count, products: [...] }
 * - 解析 ?api= 后端地址
 * - 抓取目录，展示预览
 * - 导出为 .xlsx（列顺序：Item No. / Picture / Description / MOQ / Unit Price / Link）
 */

const getApiBase = () => {
  try {
    const sp = new URLSearchParams(window.location.search);
    const api = (sp.get('api') || '').trim();
    return api.replace(/\/+$/, ''); // 去尾部 /
  } catch {
    return '';
  }
};

const LIMIT_OPTIONS = [50, 100, 200];

export default function App() {
  const API_BASE = useMemo(getApiBase, []);
  const inputRef = useRef(null);

  const [limit, setLimit] = useState(LIMIT_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]); // 预览行
  const [meta, setMeta] = useState({ ok: false, source: '', count: 0 });

  // 调试信息：在 Console 打印确认
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log('[mvp3] App loaded. API_BASE =', API_BASE || '(empty)');
  }

  const fetchCatalog = async () => {
    const url = (inputRef.current?.value || '').trim();
    if (!url) {
      alert('请先输入要抓取的目录页 URL。');
      return;
    }
    if (!API_BASE) {
      alert('未检测到 API 基地址（请在预览地址后带上 ?api=后端地址）。');
      return;
    }

    const endpoint = `${API_BASE}/v1/api/catalog/parse?url=${encodeURIComponent(
      url
    )}&limit=${limit}`;

    setLoading(true);
    setRows([]);
    setMeta({ ok: false, source: '', count: 0 });

    try {
      // 带上语言头（后端允许 x-lang，可选）
      const lang = (window.i18n && window.i18n.lang) || 'zh';
      // eslint-disable-next-line no-console
      console.log('[mvp3] fetch ->', endpoint);
      const res = await fetch(endpoint, { headers: { 'x-lang': lang } });

      // 有些场景 200 才有 body；204 是预检或无内容
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();

      if (!data || !Array.isArray(data.products)) {
        throw new Error('响应格式不正确，products 不是数组。');
      }

      setMeta({
        ok: !!data.ok,
        source: data.source || url,
        count: Number(data.count || data.products.length || 0),
      });

      // 统一成我们要的导出结构字段
      const normalized = data.products.map((p, idx) => ({
        index: idx + 1,
        // Excel: Item No.（用 sku；为空就用 index）
        itemNo: p.sku && String(p.sku).trim() ? String(p.sku).trim() : String(idx + 1),
        picture: p.img || '',
        description: p.title || '',
        moq: '', // 暂无，留空
        unitPrice: p.price || '', // 原样放 price 字段（字符串）
        link: p.url || '',
        // 额外保留原始字段以便预览时使用（不导出）
        _raw: p,
      }));

      setRows(normalized);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[mvp3] fetch error:', err);
      alert(`抓取失败：${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const exportXLSX = () => {
    if (!rows.length) {
      alert('没有可导出的数据，请先抓取。');
      return;
    }
    // 构建导出数组（按固定列顺序）
    const exportRows = rows.map((r) => ({
      'Item No.': r.itemNo,
      Picture: r.picture,
      Description: r.description,
      MOQ: r.moq,
      'Unit Price': r.unitPrice,
      Link: r.link,
    }));

    // 依赖 index.html 中已引入的 SheetJS（xlsx.full.min.js）
    // @ts-ignore
    const XLSX = window.XLSX;
    if (!XLSX) {
      alert('未检测到 XLSX 依赖，请检查 index.html 是否已引入。');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportRows, { skipHeader: false });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'catalog-preview');

    const ts = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const name = `catalog-preview-${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(
      ts.getDate()
    )}${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.xlsx`;

    XLSX.writeFile(wb, name);
  };

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', paddingBottom: 48 }}>
      <h1>MVP3 — App</h1>

      {/* 顶部绿色提醒 */}
      <div
        style={{
          background: '#e8f7e8',
          border: '1px solid #bfe5bf',
          padding: '10px 12px',
          borderRadius: 6,
          marginBottom: 10,
        }}
      >
        这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。
      </div>

      {/* 统计提示 */}
      <div
        style={{
          background: '#fff5e6',
          border: '1px solid #f5d7a3',
          padding: '10px 12px',
          borderRadius: 6,
          marginBottom: 12,
          color: '#8a6d3b',
        }}
      >
        抓取成功：共 {rows.length} 条（预览前 {limit} 条）
      </div>

      {/* 输入行 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="粘贴要抓取的目录页 URL（例如某电商分类页）"
          style={{ flex: 1, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') fetchCatalog();
          }}
        />
        <button
          className="btn btn-primary"
          disabled={loading}
          onClick={fetchCatalog}
          style={{ padding: '8px 14px' }}
        >
          {loading ? '抓取中…' : '抓取目录'}
        </button>

        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6 }}
        >
          {LIMIT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              预览（前 {n} 条）
            </option>
          ))}
        </select>

        <button className="btn" onClick={exportXLSX} style={{ padding: '8px 14px' }}>
          导出 Excel（.xlsx）
        </button>
      </div>

      {/* 预览卡片 */}
      <div
        style={{
          minHeight: 260,
          border: '1px dashed #dcdcdc',
          borderRadius: 8,
          background:
            rows.length === 0
              ? 'repeating-linear-gradient(45deg, #fafafa, #fafafa 10px, #f5f5f5 10px, #f5f5f5 20px)'
              : '#fff',
          padding: rows.length ? 12 : 0,
        }}
      >
        {rows.length === 0 ? (
          <div style={{ color: '#9aa0a6', padding: '48px 16px' }}>
            （占位区域：后续将展示抓取返回的 JSON 简要预览，或转换成表格的展示。）
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={th}>#</th>
                <th style={th}>Item No.</th>
                <th style={th}>Picture</th>
                <th style={th}>Description</th>
                <th style={th}>Unit Price</th>
                <th style={th}>Link</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((r) => (
                <tr key={r.index}>
                  <td style={td}>{r.index}</td>
                  <td style={td}>{r.itemNo}</td>
                  <td style={td}>
                    {r.picture ? (
                      <a href={r.picture} target="_blank" rel="noreferrer">
                        <img
                          src={r.picture}
                          alt=""
                          style={{ width: 56, height: 38, objectFit: 'cover', borderRadius: 4 }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </a>
                    ) : (
                      <span style={{ color: '#bbb' }}>—</span>
                    )}
                  </td>
                  <td style={td}>{r.description || '—'}</td>
                  <td style={td}>{r.unitPrice || '—'}</td>
                  <td style={td}>
                    {r.link ? (
                      <a href={r.link} target="_blank" rel="noreferrer">
                        链接
                      </a>
                    ) : (
                      <span style={{ color: '#bbb' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 一点元数据 */}
      <div style={{ color: '#9aa0a6', marginTop: 10, fontSize: 12 }}>
        {meta.source ? <>来源：{meta.source}；</> : null}
        {meta.count ? <>后端统计：{meta.count} 条。</> : null}
      </div>
    </div>
  );
}

const th = {
  textAlign: 'left',
  border: '1px solid #eee',
  padding: '8px 10px',
  whiteSpace: 'nowrap',
};

const td = {
  border: '1px solid #f3f3f3',
  padding: '8px 10px',
  verticalAlign: 'top',
};
