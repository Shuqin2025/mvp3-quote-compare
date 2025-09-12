import React, { useMemo, useRef, useState } from 'react';

/** 从 ?api=... 里读后端基址；没有就兜底一个空串（防止构建时报错） */
const API_BASE =
  new URLSearchParams(location.search).get('api')?.replace(/\/+$/, '') || '';

/** 提取“真实货号”：
 *  - 从 URL 尾部 slug 里找出以 5 位数字开头的一段
 *  - 把 -1-5- / -0-5- / -2-0- / -3-0- / -5-0- 等转成带小数点
 *  - 统一把 mhq / slim 等后缀大写
 * 例：
 *  https://.../home-cinema-35mm-...-30805-1-5-mhq-slim.html
 *  => 30805-1.5-MHQ-SLIM
 */
function extractItemNo(url = '') {
  try {
    const slug = url.split('/').pop()?.replace(/\.html?$/i, '') || '';
    const m = slug.match(/(\d{5}[-\w]*)$/i);
    if (!m) return '';
    let code = m[1];

    // 把 -1-5- / -0-5- / -2-0- / -3-0- / -5-0- 等替换成 -1.5- / -0.5- / -2.0- / ...
    code = code.replace(/-(\d)-(\d)(?=-|$)/g, '-$1.$2');

    // 统一大写常见后缀
    code = code.replace(/mhq/gi, 'MHQ').replace(/slim/gi, 'SLIM');

    return code;
  } catch {
    return '';
  }
}

/** 价格展示：null/空 -> “—”；有货币则拼接 */
function fmtPrice(price, currency) {
  if (price == null || price === '') return '—';
  return `${price}${currency || ''}`;
}

export default function App() {
  const [lang, setLang] = useState('zh');
  const [limit, setLimit] = useState(50); // 这里可设置 50 / 100 / 200 …
  const [inputUrl, setInputUrl] = useState('');
  const [items, setItems] = useState([]);
  const [hint, setHint] = useState('这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。');
  const busyRef = useRef(false);

  const countOk = items?.length || 0;
  const langLabel = useMemo(
    () =>
      ({ zh: 'CN 中文', de: 'DE Deutsch', en: 'GB English' }[lang] || 'CN 中文'),
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
      const res = await fetch(url, {
        headers: { 'x-lang': lang },
      });

      // preflight 204 时，真正的 GET 会紧跟着成功；这里只处理最终 JSON
      const data = await res.json().catch(() => ({}));

      if (!data || data.ok !== true) {
        throw new Error(data?.error || '接口返回异常');
      }
      if (!Array.isArray(data.products)) {
        throw new Error('响应格式不正确，items 不是数组。');
      }

      // 规范化 & 增补字段（itemNo）
      const normalized = data.products.map((it, idx) => {
        const itemNo = extractItemNo(it.url);
        return {
          idx: idx + 1,
          itemNo,
          title: it.title ?? '',
          url: it.url ?? '',
          price: it.price ?? null,
          currency: it.currency ?? '',
          img: it.img ?? '',
        };
      });

      setItems(normalized);
    } catch (err) {
      console.error('[mvp3] fetch error:', err);
      alert('抓取失败：' + (err?.message || String(err)));
    } finally {
      busyRef.current = false;
    }
  }

  /** 导出 .xlsx（使用全局 XLSX） */
  function onExportXlsx() {
    if (!window.XLSX) {
      alert('XLSX 未加载，请检查 index.html 中的 <script src="xlsx.full.min.js">。');
      return;
    }
    if (!items.length) {
      alert('暂无数据可导出，请先抓取。');
      return;
    }

    // 表头：Item No. / Picture / Description / MOQ / Unit Price / Link
    const rows = [
      ['Item No.', 'Picture', 'Description', 'MOQ', 'Unit Price', 'Link'],
      ...items.map((it) => [
        it.itemNo || '',                         // A: 真实货号
        it.img || '',                             // B: 图片 URL（Excel 中以超链接/文本展示）
        it.title || '',                           // C: 描述
        '',                                       // D: MOQ（暂无，留空）
        fmtPrice(it.price, it.currency),          // E: 单价
        it.url || '',                             // F: 详情链接
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // 自动列宽（简化）
    const colMax = rows.reduce(
      (acc, r) => Math.max(acc, r.length),
      0
    );
    ws['!cols'] = new Array(colMax).fill(0).map((_, i) => ({
      wch: [14, 24, 60, 8, 14, 80][i] || 16, // 每列给个合适宽度
    }));

    XLSX.utils.book_append_sheet(wb, ws, 'catalog-preview');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const name = `catalog-preview-${now.getFullYear()}-${pad(
      now.getMonth() + 1
    )}-${pad(now.getDate())}${pad(now.getHours())}${pad(
      now.getMinutes()
    )}${pad(now.getSeconds())}.xlsx`;
    XLSX.writeFile(wb, name);
  }

  return (
    <div style={{ padding: 16 }}>
      {/* 语言切换（仅演示，不改变页面文案） */}
      <div id="langSwitcher" style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <button onClick={() => setLang('zh')}>CN 中文</button>
        <button onClick={() => setLang('de')}>DE Deutsch</button>
        <button onClick={() => setLang('en')}>GB English</button>
      </div>

      <h1>MVP3 — App</h1>

      {/* 顶部提示 */}
      <div className="ui-banner ok" style={{ marginBottom: 12 }}>
        {hint}
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
        <select
          value={limit}
          onChange={(e) => setLimit(parseInt(e.target.value, 10))}
        >
          <option value={50}>预览（前 50 条）</option>
          <option value={100}>预览（前 100 条）</option>
          <option value={200}>预览（前 200 条）</option>
        </select>
        <button className="ui-secondary" onClick={onExportXlsx}>
          导出 Excel（.xlsx）
        </button>
      </div>

      {/* 预览区 */}
      <div
        style={{
          border: '1px dashed #ddd',
          borderRadius: 6,
          minHeight: 280,
          padding: 0,
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
                      <a href={it.url} target="_blank" rel="noreferrer">
                        链接
                      </a>
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
