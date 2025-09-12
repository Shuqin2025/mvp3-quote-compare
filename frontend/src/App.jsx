import React, { useMemo, useRef, useState } from "react";
import "./ui-enhance.css?v=36";

// 读取 ?api=xxx 作为后端地址（保持你原来的用法）
function getApiBase() {
  const sp = new URLSearchParams(location.search);
  const api = sp.get("api");
  return api || import.meta.env.VITE_API_BASE || "";
}

const API_BASE = getApiBase();

export default function App() {
  const [url, setUrl] = useState("");
  const [limit, setLimit] = useState(50);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ total: 0 });
  const loadingRef = useRef(false);

  async function fetchCatalog() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setRows([]);

    try {
      console.log("[mvp3] fetch ->", `${API_BASE}/v1/api/catalog/parse?url=${encodeURIComponent(url)}&limit=${limit}`);
      const resp = await fetch(
        `${API_BASE}/v1/api/catalog/parse?url=${encodeURIComponent(url)}&limit=${limit}`,
        { headers: { "X-Lang": "zh", "Cache-Control": "no-cache" } }
      );
      const data = await resp.json();
      if (!Array.isArray(data.items)) throw new Error("响应格式不正确，items 不是数组。");
      setRows(data.items);
      setStats({ total: data.items.length });
    } catch (e) {
      alert("抓取失败: " + e.message + "，请换个页面再试。");
    } finally {
      loadingRef.current = false;
    }
  }

  async function exportExcel() {
    if (!url) return;
    const link = `${API_BASE}/v1/api/catalog/export.xlsx?url=${encodeURIComponent(
      url
    )}&limit=${limit}`;
    // 直接下载后端生成的 xlsx（已嵌入真实图片）
    const a = document.createElement("a");
    a.href = link;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const preview = useMemo(
    () =>
      rows.map((r, i) => ({
        idx: i + 1,
        sku: r.sku || "",
        title: r.title || "",
        url: r.url || "",
        // 预览图统一走后端图片代理，避免 CORS
        img: r.img ? `${API_BASE}/v1/api/img?url=${encodeURIComponent(r.img)}` : "",
        price:
          r.price && r.currency ? `${r.price}${r.currency}` : r.price || "",
      })),
    [rows]
  );

  return (
    <div className="wrap">
      <h1>MVP3 — App</h1>

      <div className="tip ok">
        这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。
      </div>

      <div className="tip info">
        抓取成功：共 {stats.total} 条（预览前 {limit} 条）
      </div>

      <div className="toolbar">
        <input
          className="url"
          placeholder="粘贴要抓取的目录页 URL（例如某电商分类页）"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="primary" onClick={fetchCatalog}>
          抓取目录
        </button>
        <select value={limit} onChange={(e) => setLimit(parseInt(e.target.value, 10))}>
          {[50, 100, 150, 200, 300, 500].map((n) => (
            <option value={n} key={n}>
              预览（前 {n} 条）
            </option>
          ))}
        </select>
        <button onClick={exportExcel}>导出 Excel（.xlsx）</button>
      </div>

      <div className="table">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item No.</th>
              <th>Picture</th>
              <th>Description</th>
              <th>Unit Price</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((r) => (
              <tr key={r.idx}>
                <td>{r.idx}</td>
                <td>{r.sku}</td>
                <td>
                  {r.img ? (
                    <img src={r.img} alt="" style={{ width: 56, height: 56, objectFit: "contain" }} />
                  ) : (
                    "-"
                  )}
                </td>
                <td>{r.title}</td>
                <td>{r.price || "—"}</td>
                <td>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer">
                      链接
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {preview.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "#999" }}>
                  （占位区域：后续将展示抓取返回的 JSON 简要预览，或转换成表格的展示。）
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="foot">© MVP3 — 页面骨架（占位版）。确认部署稳定后，将逐步接回业务逻辑。</div>
    </div>
  );
}
