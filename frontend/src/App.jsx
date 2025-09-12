// frontend/src/App.jsx
import React, { useMemo, useState } from 'react';
import axios from 'axios';

// 从 URL ?api=<backend> 读取 API 基址（无参时提示配置）
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
    link: '链接'
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
    link: 'Link'
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
      if (!Array.isArray(items)) throw new Error('items_not_array');
      setList(items);
    } catch (e) {
      console.error('[mvp3] fetch error:', e);
      alert(t.failed);
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  // —— Excel 导出：使用 exceljs，把图片真正嵌入 xlsx —— //
  async function exportExcel() {
    if (!window.ExcelJS) {
      alert('ExcelJS 未加载');
      return;
    }
    const ExcelJS = window.ExcelJS;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('catalog');

    ws.columns = [
      { header: 'Item No.', key: 'sku', width: 22 },
      { header: 'Picture', key: 'pic', width: 18 }, // 用于放图
      { header: 'Description', key: 'title', width: 60 },
      { header: 'MOQ', key: 'moq', width: 10 },
      { header: 'Unit Price', key: 'price', width: 14 },
      { header: 'Link', key: 'url', width: 80 },
    ];

    // 逐行写入（先写文本，图片后贴）
    list.forEach((it) => {
      ws.addRow({
        sku: it.sku || '',
        pic: '', // 这里先留空，下面贴图
        title: it.title || '',
        moq: it.moq || '',
        price: it.price || '',
        url: it.url || '',
      });
    });

    // 给“Link”列加超链接样式
    for (let r = 2; r <= list.length + 1; r++) {
      const cell = ws.getCell(`F${r}`);
      const url = list[r - 2]?.url || '';
      if (url) {
        cell.value = { text: t.link, hyperlink: url };
        cell.font = { color: { argb: 'FF1F497D' }, underline: true };
      }
      // Picture 列设合适行高
      ws.getRow(r).height = 72;
    }

    // 嵌入图片（并不是所有站都允许跨域拉图，这里前端直接 fetch blob → buffer 再嵌）
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      const imgUrl = it.img || '';
      if (!imgUrl) continue;

      try {
        const resp = await fetch(imgUrl, { mode: 'no-cors' }).catch(() => null) || await fetch(imgUrl);
        const blob = await resp.blob();
        const buffer = await blob.arrayBuffer();

        // 猜扩展名
        const isPng = /png$/i.test(imgUrl) || blob.type.includes('png');
        const imageId = wb.addImage({
          buffer: Buffer.from(buffer),
          extension: isPng ? 'png' : 'jpeg',
        });

        // 贴到 B 列（第 i+2 行）
        const row = i + 2;
        ws.addImage(imageId, {
          tl: { col: 1 + 0.15, row: row - 1 + 0.15 }, // B列=1（0-based）
          ext: { width: 96, height: 64 },
          editAs: 'twoCell',
        });
      } catch (err) {
        console.warn('embed image failed', imgUrl, err);
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = `catalog-preview-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.xlsx`;
    // FileSaver 不要求，但原生也能下载：
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // 语言按钮
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

        <button className="btn" onClick={exportExcel}>{t.export}</button>
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
                    {it.img ? <img src={it.img} alt="" style={{width: 72, height: 48, objectFit:'contain'}}/> : null}
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
