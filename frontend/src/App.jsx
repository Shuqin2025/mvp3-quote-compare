import React, { useMemo, useRef, useState } from 'react';

/** 读取后端 API 基址（来自 ?api=...）；去掉尾部 / */
const API_BASE =
  new URLSearchParams(location.search).get('api')?.replace(/\/+$/, '') || '';

/** 提取真实货号：从 URL 最后段匹配如 30805-1-5-mhq-slim */
function extractItemNo(url = '') {
  try {
    const slug = url.split('/').pop()?.replace(/\.html?$/i, '') || '';
    const m = slug.match(/(\d{5}[-\w]*)$/i);
    if (!m) return '';
    let code = m[1];
    // 把 -1-5- / -0-5- / -2-0- / -3-0- / -5-0- 转成 -1.5- / -0.5- / -2.0- / ...
    code = code.replace(/-(\d)-(\d)(?=-|$)/g, '-$1.$2');
    // 常见后缀大写
    code = code.replace(/mhq/gi, 'MHQ').replace(/slim/gi, 'SLIM');
    return code;
  } catch {
    return '';
  }
}

function fmtPrice(price, currency) {
  if (price == null || price === '') return '—';
  return `${price}${currency || ''}`;
}

export default function App() {
  const [lang, setLang] = useState('zh');
  const [limit, setLimit] = useState(50);
  const [inputUrl, setInputUrl] = useState('');
  const [items, setItems] = useState([]);
  const [hint] = useState('这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。');
  const busyRef = useRef(false);

  const countOk = items?.length || 0;
  const langLabel = useMemo(
    () => ({ zh: 'CN 中文', de: 'DE Deutsch', en: 'GB English' }[lang] || 'CN 中文'),
    [lang]
  );

  async function onFetch() {
    if (busyRef.current) return;
    if (!API_BASE) {
      alert('未检测到后端 API 基址，请以 ?api=... 的方式打开页面。');
      return;
    }
    if (!inputUrl.trim()) {
      alert('请先粘贴要抓取的目录页 URL。');
      return;
    }

    busyRef.current = true;
    setItems([]);
    try {
      const url = `${API_BASE}/v1/api/catalog/parse?url=${encodeURIComponent(
        inputUrl.trim()
      )}&limit=${limit}`;
      console.log('[mvp3] fetch ->', url);

      const res = await fetch(url, { headers: { 'x-lang': lang } });
      const data = await res.json().catch(() => ({}));

      if (!data || data.ok !== true) throw new Error(data?.error || '接口返回异常');
      if (!Array.isArray(data.products)) throw new Error('响应格式不正确，items 不是数组。');

      const normalized = data.products.map((it, idx) => ({
        idx: idx + 1,
        itemNo: extractItemNo(it.url),
        title: it.title ?? '',
        url: it.url ?? '',
        price: it.price ?? null,
        currency: it.currency ?? '',
        img: it.img ?? '',
      }));

      setItems(normalized);
    } catch (err) {
      console.error('[mvp3] fetch error:', err);
      alert('抓取失败：' + (err?.message || String(err)));
    } finally {
      busyRef.current = false;
    }
  }

  /** 导出 .xlsx：Picture 列使用 IMAGE() 公式嵌入图片 */
  function onExportXlsx() {
    if (!window.XLSX) {
      alert('XLSX 未加载，请检查 index.html 中的 <script src="xlsx.full.min.js">。');
      return;
    }
    if (!items.length) {
      alert('暂无数据可导出，请先抓取。');
      return;
    }

    // AOA 先铺数据（Picture 用占位，稍后再写入公式）
    const rows = [
      ['Item No.', 'Picture', 'Description', 'MOQ', 'Unit Price', 'Link'],
      ...items.map((it) => [
        it.itemNo || '',
        it.img || '',                    // 先放 URL 作为备用值
        it.title || '',
        '',
        fmtPrice(it.price, it.currency),
        it.url || '',
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // 给 Picture 列（B列）写入 IMAGE() 公式（自第2行开始）
    items.forEach((it, i) => {
      const r = 2 + i; // header 在第1行
      const addr = `B${r}`;
      if (it.img) {
        // 设置备用显示值（老版本 Excel 不支持时至少能看到 URL）
        ws[addr] = { t: 's', v: it.img, f: `IMAGE("${it.img}")` };
      }
    });

    // 设置列宽
    ws['!cols'] = [
      { wch: 20 }, // Item No.
      { wch: 24 }, // Picture
      { wch: 60 }, // Description
      { wch: 8  }, // MOQ
      { wch: 14 }, // Unit Price
      { wch: 90 }, // Link
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'catalog-preview');

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const name = `catalog-preview-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.xlsx`;
    XLSX.writeFile(wb, name);
  }

  return (
    <div style={{ padding: 16 }}>
      {/* 语言切换（只保留这一组） */}
      <div id="langSwitcher" style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <button onClick={() => setLang('zh')}>CN 中文</button>
        <button onClick={() => setLang('de')}>DE Deutsch</button>
        <button onClick={() => setLang('en')}>GB English</button>
      </div>

      <h1>MVP3 — App</h1>

      {/* 顶部提示 */}
      <div className="ui-banner ok" style={{ marginBottom: 12 }}>
        这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。
      </div>

      {/* 统计条 */}
      <div className="ui-banner info" style={{ marginBottom: 12 }}>
        抓取成功：共 {countOk} 条（预览前 {limit} 条）
      </div>

      {/* 输入区 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input
          style={{ flex: 1 }}
          placeholder="粘贴要抓取的目录页 URL（例如某电商分类页）"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
        />
        <button className="ui-primary" onClick={onFetch}>
          {busyRef.current ? '抓取中…' : '抓取目录'}
        </button>
        <select value={limit} onChange={(e) => setLimit(parseInt(e.target.value, 10))}>
          <option value={50}>预览（前 50 条）</option>
          <option value={100}>预览（前 100 条）</option>
          <option value={200}>预览（前 200 条）</option>
        </select>
        <button className="ui-secondary" onClick={onExportXlsx}>导出 Excel（.xlsx）</button>
      </div>

      {/* 预览区 */}
      <div
        style={{
          border: '1px dashed #ddd',
          borderRadius: 6,
          minHeight: 280,
          overflow: 'auto',
        }}
      >
        {items.length === 0 ? (
          <div style={{ padding: 16, color: '#888' }}>
            （占位区域：后续将展示抓取返回的 JSON 简要预览，或转换成表格的展示。）
          </div>
        ) : (
          <table className="ui-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ width: 64, textAlign: 'center' }}>#</th>
                <th style={{ width: 160 }}>Item No.</th>
                <th style={{ width: 120 }}>Picture</th>
                <th>Description</th>
                <th style={{ width: 120, textAlign: 'right' }}>Unit Price</th>
                <th style={{ width: 80, textAlign: 'center' }}>Link</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.idx}>
                  <td style={{ textAlign: 'center' }}>{it.idx}</td>
                  <td>{it.itemNo || ''}</td>
                  <td>
                    {it.img ? (
                      <img
                        src={it.img}
                        alt=""
                        style={{ width: 86, height: 86, objectFit: 'contain', background: '#f7f7f7' }}
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{it.title || ''}</td>
                  <td style={{ textAlign: 'right' }}>{fmtPrice(it.price, it.currency)}</td>
                  <td style={{ textAlign: 'center' }}>
                    {it.url ? (
                      <a href={it.url} target="_blank" rel="noreferrer">链接</a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 页脚 */}
      <div style={{ color: '#888', fontSize: 12, marginTop: 12 }}>
        © MVP3 — 页面骨架（占位版）。确认部署稳定后，将逐步接回业务逻辑。
      </div>
    </div>
  );
}
