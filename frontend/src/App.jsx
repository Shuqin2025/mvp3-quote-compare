// frontend/src/App.jsx
import React, { useMemo, useRef, useState } from "react";
import "./app.css";

// ExcelJS 通过 index.html 里的 CDN 注入到 window.ExcelJS
const getExcelJS = () => window.ExcelJS;

// 从 ?api= 读后端地址
function getApiBase() {
  const u = new URL(location.href);
  const api = u.searchParams.get("api");
  return (api && api.trim()) || "";
}

const LANGS = {
  zh: {
    title: "MVP3 — App",
    inputPlaceholder: "粘贴要抓取的目录页 URL（例如某电商分类页）",
    btnFetch: "抓取目录",
    preview: "预览（前 {{n}} 条）",
    exportExcel: "导出 Excel（.xlsx）",
    fetchedCount: "抓取成功：共 {{n}} 条（预览前 {{m}} 条）",
    linkText: "链接",
    th: ["Item No.", "Picture", "Description", "MOQ", "Unit Price", "Link"]
  },
  de: {
    title: "MVP3 — App",
    inputPlaceholder: "Kategorie-URL einfügen (z. B. Shop-Kategorie)",
    btnFetch: "Katalog holen",
    preview: "Vorschau (erste {{n}})",
    exportExcel: "Excel exportieren (.xlsx)",
    fetchedCount: "Erfolg: {{n}} Einträge (Vorschau {{m}})",
    linkText: "Link",
    th: ["Item No.", "Picture", "Description", "MOQ", "Unit Price", "Link"]
  },
  en: {
    title: "MVP3 — App",
    inputPlaceholder: "Paste a category URL (e.g., shop listing page)",
    btnFetch: "Fetch",
    preview: "Preview (first {{n}})",
    exportExcel: "Export Excel (.xlsx)",
    fetchedCount: "Fetched: {{n}} (preview {{m}})",
    linkText: "Link",
    th: ["Item No.", "Picture", "Description", "MOQ", "Unit Price", "Link"]
  }
};

function useI18n() {
  const [lang, setLang] = useState("zh");
  const T = useMemo(() => LANGS[lang], [lang]);
  return { T, lang, setLang };
}

export default function App() {
  const { T, lang, setLang } = useI18n();
  const API_BASE = getApiBase();
  const [url, setUrl] = useState("https://www.s-impuls-shop.de/catalog/home-cinema/audio-kabel");
  const [limit, setLimit] = useState(50);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const listRef = useRef(null);

  async function fetchCatalog() {
    if (!API_BASE) {
      alert("后端 API 未指定。请在预览地址后加 ?api=你的后端域名");
      return;
    }
    if (!url) return;
    setLoading(true);
    try {
      const q = new URL(API_BASE + "/v1/api/catalog/parse");
      q.searchParams.set("url", url);
      q.searchParams.set("limit", String(limit));
      console.log("[mvp3] fetch ->", q.toString());

      const r = await fetch(q.toString());
      const data = await r.json().catch(() => ({}));

      if (!Array.isArray(data.items)) {
        console.error("[mvp3] fetch error:", data);
        alert("抓取失败：响应格式不正确，items 不是数组。");
        return;
      }
      setRows(data.items || []);
    } catch (e) {
      console.error(e);
      alert("抓取失败，请刷新页面重试。");
    } finally {
      setLoading(false);
    }
  }

  function PreviewTable() {
    const th = T.th;
    const preview = rows.slice(0, limit);
    return (
      <div className="preview">
        <table>
          <thead>
            <tr>
              {th.map((t, i) => (
                <th key={i}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((it, idx) => (
              <tr key={idx}>
                <td>{it.sku || ""}</td>
                <td>
                  {it.img ? (
                    <img src={`${API_BASE}/v1/api/img?url=${encodeURIComponent(it.img)}`} width={72} height={72}
                      style={{ objectFit: "contain", borderRadius: 6, border: "1px solid #ddd" }} />
                  ) : null}
                </td>
                <td>{it.title || ""}</td>
                <td>{it.moq || ""}</td>
                <td>
                  {it.price ? `${it.price}${it.currency || ""}` : ""}
                </td>
                <td>
                  {it.url ? (
                    <a href={it.url} target="_blank" rel="noreferrer">{T.linkText}</a>
                  ) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  async function exportExcel() {
    if (!rows.length) return;

    const ExcelJS = getExcelJS();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("catalog");

    // 列宽行高
    ws.columns = [
      { header: T.th[0], key: "sku", width: 22 },
      { header: T.th[1], key: "picture", width: 16 },
      { header: T.th[2], key: "title", width: 60 },
      { header: T.th[3], key: "moq", width: 10 },
      { header: T.th[4], key: "price", width: 14 },
      { header: T.th[5], key: "link", width: 80 },
    ];

    // 表头加粗
    ws.getRow(1).font = { bold: true };

    // 逐行写入，并在第 2 列插入图片
    const imagePromises = rows.map(async (it, idx) => {
      const rowIndex = idx + 2;
      ws.addRow({
        sku: it.sku || "",
        title: it.title || "",
        moq: it.moq || "",
        price: it.price ? `${it.price}${it.currency || ""}` : "",
        link: it.url || ""
      });

      // 超链接
      if (it.url) {
        ws.getCell(rowIndex, 6).value = { text: T.linkText, hyperlink: it.url };
        ws.getCell(rowIndex, 6).font = { color: { argb: "FF1F4E79" }, underline: true };
      }

      // 图片（通过后端代理取图，避免 CORS）
      if (it.img) {
        try {
          const imgUrl = `${API_BASE}/v1/api/img?url=${encodeURIComponent(it.img)}`;
          const resp = await fetch(imgUrl);
          const buf = await resp.arrayBuffer();

          // 试探图片类型
          let ext = "jpeg";
          const ctype = resp.headers.get("content-type") || "";
          if (/png/i.test(ctype)) ext = "png";
          if (/jpe?g/i.test(ctype)) ext = "jpeg";
          const imgId = wb.addImage({ buffer: Buffer.from(buf), extension: ext });

          // 在第 rowIndex 行、第 2 列放一个 64x64 的缩略图
          const top = (rowIndex - 1) * 20 + 2; // 行高约 20，微调
          ws.addImage(imgId, {
            tl: { col: 1.2, row: rowIndex - 0.7 },
            ext: { width: 64, height: 64 },
            editAs: "oneCell",
          });

          // 行高稍微大一点
          ws.getRow(rowIndex).height = 54;
        } catch (e) {
          // 忽略单张图片失败
          console.warn("image error", it.img, e);
        }
      }
    });

    await Promise.all(imagePromises);

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");
    a.download = `catalog-${ts}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app">
      <div className="lang">
        <button onClick={() => setLang("zh")}>CN 中文</button>
        <button onClick={() => setLang("de")}>DE Deutsch</button>
        <button onClick={() => setLang("en")}>GB English</button>
      </div>

      <h1>{T.title}</h1>

      <div className="tip ok">
        这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。
      </div>

      <div className="tip warn">
        {T.fetchedCount.replace("{{n}}", rows.length).replace("{{m}}", limit)}
      </div>

      <div className="toolbar">
        <input
          placeholder={T.inputPlaceholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button disabled={loading} onClick={fetchCatalog}>
          {loading ? "抓取中..." : T.btnFetch}
        </button>

        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          {[50, 100, 200].map((n) => <option key={n} value={n}>{T.preview.replace("{{n}}", n)}</option>)}
        </select>

        <button onClick={exportExcel}>{T.exportExcel}</button>
      </div>

      <div ref={listRef}>
        <PreviewTable />
      </div>
    </div>
  );
}
