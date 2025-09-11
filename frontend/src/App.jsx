import React, { useEffect, useMemo, useState } from "react";

/**
 * MVP3 — 升级版（恢复字段、图片、价格、Excel 导出）
 */

export default function App() {
  const t = {
    title: "MVP3 — App",
    hint: "这是页面骨架的占位提示，用于验证部署和抓取接口。",
    inputPh: "粘贴要抓取的目录页 URL（例如某电商分类页）",
    btnFetch: "抓取目录",
    btnExport: "导出 Excel（.xlsx）",
    warnNeedUrl: "请先粘贴要抓取的目录页 URL。",
    fail: "抓取失败，请换个页面试试。",
  };

  const API_BASE = useMemo(() => {
    try {
      const u = new URL(window.location.href);
      const fromQuery = (u.searchParams.get("api") || "").trim();
      const fromEnv = (import.meta?.env?.VITE_API_BASE || "").trim();
      const base = fromQuery || fromEnv || "";
      console.log("[mvp3] App loaded. API_BASE =", base || "<empty>");
      return base;
    } catch {
      return "";
    }
  }, []);

  const [url, setUrl] = useState("");
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (window.uiEnhance?.mount) window.uiEnhance.mount();
    return () => cancelAnimationFrame(0);
  }, []);

  const parseEndpoint = useMemo(() => {
    return API_BASE ? `${API_BASE.replace(/\/+$/, "")}/v1/api/catalog/parse` : "";
  }, [API_BASE]);

  async function fetchCatalog() {
    if (!url.trim()) return alert(t.warnNeedUrl);
    if (!parseEndpoint) return alert("未配置 API_BASE，无法调用后端解析接口。");

    setLoading(true);
    setItems([]);
    setCount(0);
    try {
      const apiUrl = `${parseEndpoint}?url=${encodeURIComponent(url.trim())}`;
      console.log("[mvp3] fetch:", apiUrl);
      const res = await fetch(apiUrl, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list);
      setCount(Number(data?.total || list.length || 0));
    } catch (err) {
      console.error(err);
      alert(t.fail);
    } finally {
      setLoading(false);
    }
  }

  async function exportXlsx() {
    if (!items.length) return;
    const XLSX = await import("xlsx");

    const headers = ["产品编号", "图片", "标题/描述", "价格", "链接"];
    const rows = items.map((it) => [
      it.sku || "",
      it.img || "",
      it.title || "",
      it.price && it.currency ? `${it.price} ${it.currency}` : it.price || "",
      it.url || "",
    ]);

    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "catalog");
    const blob = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const file = new Blob([blob], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const link = document.createElement("a");
    link.download = `catalog-preview-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "")}.xlsx`;
    link.href = URL.createObjectURL(file);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const shown = items.slice(0, limit);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px" }}>
      <div id="langSwitcher" style={{ marginBottom: 12 }}>
        <button onClick={() => window.i18n?.setLang?.("zh")}>CN 中文</button>
        <button onClick={() => window.i18n?.setLang?.("de")}>DE Deutsch</button>
        <button onClick={() => window.i18n?.setLang?.("en")}>GB English</button>
      </div>

      <h1>{t.title}</h1>

      <div
        style={{
          background: "#eafaea",
          border: "1px solid #b7e3b7",
          padding: "12px 16px",
          borderRadius: 6,
          margin: "10px 0",
        }}
      >
        {t.hint}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <input
          placeholder={t.inputPh}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ flex: 1, padding: "10px 12px", border: "1px solid #ddd", borderRadius: 6 }}
        />
        <button onClick={fetchCatalog} disabled={loading}>
          {loading ? "抓取中…" : t.btnFetch}
        </button>
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value || 50))}>
          {[10, 20, 30, 50, 100].map((n) => (
            <option key={n} value={n}>
              预览前 {n} 条
            </option>
          ))}
        </select>
        <button onClick={exportXlsx} disabled={!items.length}>
          {t.btnExport}
        </button>
      </div>

      <div
        style={{
          minHeight: 260,
          border: "1px dashed #d9d9d9",
          borderRadius: 8,
          padding: 16,
          background: !shown.length ? "#f9f9f9" : "#fff",
        }}
      >
        {shown.length ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th>编号</th>
                <th>图片</th>
                <th>标题</th>
                <th>价格</th>
                <th>链接</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((it, idx) => (
                <tr key={idx}>
                  <td>{it.sku || ""}</td>
                  <td>
                    {it.img ? (
                      <a href={it.img} target="_blank" rel="noreferrer">
                        查看
                      </a>
                    ) : (
                      ""
                    )}
                  </td>
                  <td>{it.title || ""}</td>
                  <td>{it.price && it.currency ? `${it.price} ${it.currency}` : it.price || ""}</td>
                  <td>
                    {it.url ? (
                      <a href={it.url} target="_blank" rel="noreferrer">
                        打开
                      </a>
                    ) : (
                      ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <span style={{ color: "#999" }}>（抓取结果将显示在此处）</span>
        )}
      </div>
    </div>
  );
}
