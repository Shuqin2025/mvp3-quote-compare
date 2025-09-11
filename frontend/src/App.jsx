import React, { useEffect, useMemo, useState } from "react";

/**
 * MVP3 — 占位框架（可预览/导出）
 * - 通过 URL ?api=<你的后端> 传入 API 基址；否则从 import.meta.env 读取
 * - 目录抓取：统一调用  GET {API_BASE}/v1/api/catalog/parse?url=<目录URL>
 * - 仅做“占位/连通性验证”，不包含真实脚本规则
 */

export default function App() {
  // UI 文案（极简）
  const t = {
    title: "MVP3 — App",
    hint:
      "这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。",
    statPrefix: "抓取成功：共",
    statSuffix: "条（预览前 50 条）",
    inputPh: "粘贴要抓取的目录页 URL（例如某电商分类页）",
    btnFetch: "抓取目录",
    btnExport: "导出 Excel（.xlsx）",
    preview: "预览（前 50 条）",
    ok: "确定",
    warnNeedUrl: "请先粘贴要抓取的目录页 URL。",
    fail: "抓取失败，请换个页面试试。",
  };

  // 解析 API Base：优先读取 ?api=xxx 其后回退 env
  const API_BASE = useMemo(() => {
    try {
      const u = new URL(window.location.href);
      const fromQuery = (u.searchParams.get("api") || "").trim();
      const fromEnv =
        (import.meta?.env?.VITE_API_BASE || import.meta?.env?.VITE_API_URL || "")
          .trim();
      const base = fromQuery || fromEnv || "";
      console.log("[mvp3] App loaded. API_BASE =", base || "<empty>");
      return base;
    } catch {
      return "";
    }
  }, []);

  // 组件状态
  const [url, setUrl] = useState("");
  const [items, setItems] = useState([]); // {title, sku, price, currency, url, img, preview}[]
  const [count, setCount] = useState(0);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);

  // 语言按钮只是示意，不做真 i18n
  useEffect(() => {
    if (window.uiEnhance?.mount) window.uiEnhance.mount();
    return () => cancelAnimationFrame(0);
  }, []);

  const parseEndpoint = useMemo(() => {
    // 后端统一入口（本次修复的关键）
    return API_BASE ? `${API_BASE.replace(/\/+$/, "")}/v1/api/catalog/parse` : "";
  }, [API_BASE]);

  async function fetchCatalog() {
    if (!url.trim()) {
      alert(t.warnNeedUrl);
      return;
    }
    if (!parseEndpoint) {
      alert("未配置 API_BASE，无法调用后端解析接口。");
      return;
    }
    setLoading(true);
    setItems([]);
    setCount(0);
    try {
      const apiUrl =
        `${parseEndpoint}?url=${encodeURIComponent(url.trim())}`;
      console.log("[mvp3] fetch:", apiUrl);
      const res = await fetch(apiUrl, {
        // 这里可以按需补充自定义头 X-Lang / UA 等
        headers: { "Accept": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // 预期后端返回 { total, items: [] }
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

  // 导出 .xlsx（使用 SheetJS，浏览器端可直接下载）
  async function exportXlsx() {
    if (!items.length) return;
    // 动态加载 SheetJS 以减小首屏体积
    const XLSX = await import("xlsx");

    const headers = [
      "Item No.", // sku 或编号
      "Picture",  // img
      "Description", // title
      "MOQ",
      "Unit Price", // price + currency
      "Link", // url
    ];

    const rows = items.map((it) => [
      it.sku || "",
      it.img || "",
      it.title || "",
      it.moq || "",
      it.price != null && it.currency
        ? `${it.price} ${it.currency}`
        : it.price || "",
      it.url || "",
    ]);

    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "catalog");
    const blob = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const file = new Blob([blob], {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
      {/* 顶部语言切换（演示） */}
      <div id="langSwitcher" style={{ margin: "0 0 12px" }}>
        <button onClick={() => (window.i18n?.setLang?.("zh"))}>CN 中文</button>
        <button onClick={() => (window.i18n?.setLang?.("de"))}>DE Deutsch</button>
        <button onClick={() => (window.i18n?.setLang?.("en"))}>GB English</button>
      </div>

      <h1 data-i18n="title_app">{t.title}</h1>

      {/* 顶部提示 */}
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

      {/* 统计区 */}
      <div
        style={{
          background: "#fff7e6",
          border: "1px solid #ffe6b3",
          padding: "10px 16px",
          borderRadius: 6,
          margin: "10px 0 14px",
        }}
      >
        {`抓取成功：共 ${count} 条（预览前 ${limit} 条）`}
      </div>

      {/* 输入 + 操作 */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <input
          placeholder={t.inputPh}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: 6,
          }}
        />
        <button
          onClick={fetchCatalog}
          disabled={loading}
          style={{ padding: "10px 14px" }}
        >
          {loading ? "抓取中…" : t.btnFetch}
        </button>

        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value || 50))}
          style={{ padding: "10px 8px" }}
        >
          {[10, 20, 30, 50, 100].map((n) => (
            <option key={n} value={n}>
              {`预览（前 ${n} 条）`}
            </option>
          ))}
        </select>

        <button
          onClick={exportXlsx}
          disabled={!items.length}
          style={{ padding: "10px 14px" }}
        >
          {t.btnExport}
        </button>
      </div>

      {/* 预览表格（占位） */}
      <div
        style={{
          minHeight: 260,
          border: "1px dashed #d9d9d9",
          borderRadius: 8,
          padding: 16,
          background:
            !shown.length
              ? "repeating-linear-gradient(45deg,#fafafa,#fafafa 10px,#f5f5f5 10px,#f5f5f5 20px)"
              : "#fff",
        }}
      >
        {shown.length ? (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr>
                {["title", "sku", "price", "currency", "url", "img"].map((k) => (
                  <th
                    key={k}
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #eee",
                      padding: "8px 6px",
                    }}
                  >
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((it, idx) => (
                <tr key={idx}>
                  <td style={{ padding: "8px 6px" }}>{it.title || ""}</td>
                  <td style={{ padding: "8px 6px" }}>{it.sku || ""}</td>
                  <td style={{ padding: "8px 6px" }}>{it.price ?? ""}</td>
                  <td style={{ padding: "8px 6px" }}>{it.currency || ""}</td>
                  <td style={{ padding: "8px 6px" }}>
                    {it.url ? (
                      <a href={it.url} target="_blank" rel="noreferrer">
                        链接
                      </a>
                    ) : (
                      ""
                    )}
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {it.img ? (
                      <a href={it.img} target="_blank" rel="noreferrer">
                        链接
                      </a>
                    ) : (
                      ""
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <span style={{ color: "#999" }}>（占位区域，仅在抓取后显示预览）</span>
        )}
      </div>

      <div style={{ color: "#888", marginTop: 18, fontSize: 13 }}>
        © MVP3 — 页面骨架（占位版）。确认部署稳定后，将逐步接回业务逻辑。
      </div>
    </div>
  );
}
