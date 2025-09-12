import React, { useMemo, useState, useEffect } from "react";

/** 读取 API 基座：优先 ?api= 其后才是 VITE_API_BASE/VITE_API_URL */
function useApiBase() {
  return useMemo(() => {
    try {
      const u = new URL(window.location.href);
      const fromQuery = (u.searchParams.get("api") || "").trim();
      const fromEnv =
        (import.meta?.env?.VITE_API_BASE || import.meta?.env?.VITE_API_URL || "").trim();
      return fromQuery || fromEnv || "";
    } catch {
      return "";
    }
  }, []);
}

/** 把后端响应最大兼容地取出 items 数组 */
function pickItems(payload) {
  if (Array.isArray(payload)) return payload;

  // 常见形态
  if (payload?.items) {
    if (Array.isArray(payload.items)) return payload.items;
    if (payload.items && typeof payload.items === "object") return Object.values(payload.items);
  }
  if (payload?.data?.items) {
    if (Array.isArray(payload.data.items)) return payload.data.items;
    if (payload.data.items && typeof payload.data.items === "object")
      return Object.values(payload.data.items);
  }

  // 其它约定
  if (payload && Array.isArray(payload.list)) return payload.list;
  if (payload && Array.isArray(payload.rows)) return payload.rows;
  if (payload?.data && Array.isArray(payload.data)) return payload.data;
  if (payload?.result?.items) {
    if (Array.isArray(payload.result.items)) return payload.result.items;
    if (payload.result.items && typeof payload.result.items === "object")
      return Object.values(payload.result.items);
  }

  // 如果 payload 是对象集合
  if (payload && typeof payload === "object") {
    const vals = Object.values(payload);
    if (vals.length && vals.every((x) => typeof x === "object")) return vals;
  }

  throw new Error("响应格式不正确，items 不是数组。");
}

/** 规范化每条记录到我们需要的列 */
function normalizeItem(x = {}) {
  const title = x.title ?? x.name ?? x.productName ?? x.description ?? x.desc ?? "";
  const sku = x.sku ?? x.code ?? x.no ?? x.itemNo ?? x.number ?? "";
  const price = x.price ?? x.unitPrice ?? x.minPrice ?? x.salesPrice ?? x.amount ?? "";
  const currency = x.currency ?? x.ccy ?? x.curr ?? "";
  const url = x.url ?? x.link ?? x.href ?? x.detailUrl ?? "";
  const img =
    x.img ?? x.image ?? x.picture ?? x.imgUrl ?? x.imageUrl ?? x.pic ?? x.photo ?? "";
  return { title, sku, price, currency, url, img };
}

/** 生成 .xlsx（固定列） */
function exportToXlsx(items, filename = "catalog-preview.xlsx") {
  if (!Array.isArray(items) || !items.length) {
    alert("没有数据可导出。");
    return;
  }
  const header = ["Item No.", "Picture", "Description", "MOQ", "Unit Price", "Link"];
  const body = items.map((it) => [
    it.sku || "",
    it.img || "",
    it.title || "",
    "", // MOQ 暂无
    it.price != null && it.price !== "" ? `${it.price}${it.currency ? ` ${it.currency}` : ""}` : "",
    it.url || "",
  ]);
  const aoa = [header, ...body];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
}

export default function App() {
  const API_BASE = useApiBase();

  const [url, setUrl] = useState("");
  const [limit, setLimit] = useState(100); // 预览上限：默认 100，亦可选 50 / 200
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState({
    ok: true,
    msg: "这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。",
  });
  const [items, setItems] = useState([]);

  const disabled = !API_BASE || loading;

  useEffect(() => {
    // 方便排查：控制台打印一次 API_BASE
    // （你页面右侧 Console 能看到：[mvp3] App loaded. API_BASE = ...）
    console.log("[mvp3] App loaded. API_BASE =", API_BASE);
  }, [API_BASE]);

  async function handleFetch() {
    if (!API_BASE) {
      alert("没有 API 基座。请使用 ?api=后端预览地址 访问页面。");
      return;
    }
    if (!url.trim()) {
      alert("请先输入要抓取的目录页 URL。");
      return;
    }

    setLoading(true);
    setInfo({ ok: true, msg: "抓取中..." });
    setItems([]);

    try {
      // 为避免触发 CORS 预检，这里不再加自定义请求头，把语言通过查询参数传递
      const lang =
        (window.i18n && window.i18n.lang) ||
        (navigator.language || "zh").slice(0, 2);

      const reqUrl =
        `${API_BASE.replace(/\/+$/, "")}` +
        `/v1/api/catalog/parse?url=${encodeURIComponent(url.trim())}` +
        `&limit=${encodeURIComponent(String(limit))}` +
        `&lang=${encodeURIComponent(lang)}`;

      console.log("[mvp3] fetch ->", reqUrl);

      const res = await fetch(reqUrl, {
        method: "GET",
        headers: { Accept: "application/json" }, // 仅使用“简单首部”，避免 204 预检留存
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}\n${text.slice(0, 300)}...`);
      }

      let json;
      try {
        json = JSON.parse(text);
      } catch {
        // 不是 JSON，给出截断内容方便排查
        throw new Error(`后端未返回合法 JSON：\n${text.slice(0, 300)}...`);
      }

      const rawItems = pickItems(json);
      const list = rawItems.map(normalizeItem);

      setItems(list);
      setInfo({ ok: true, msg: `抓取成功：共 ${list.length} 条（预览前 ${limit} 条）` });
    } catch (err) {
      console.error("[mvp3] fetch error:", err);
      setInfo({ ok: false, msg: `抓取失败：${err.message}` });
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    if (!items.length) {
      alert("没有数据可导出，请先抓取。");
      return;
    }
    exportToXlsx(items, "catalog-preview.xlsx");
  }

  const preview = useMemo(() => items.slice(0, limit), [items, limit]);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px" }}>
      <h1 data-i18n="title_app" style={{ margin: "0 0 12px" }}>MVP3 — App</h1>

      <div className={info.ok ? "ui-notice ok" : "ui-notice warn"} style={{ marginBottom: 12 }}>
        {info.msg}
        {API_BASE ? null : (
          <div style={{ marginTop: 6 }}>
            当前未检测到 API 地址。请使用：
            <code>https://你的预览域名/?api=https://你的后端域名</code>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          style={{ flex: 1, padding: "8px 10px" }}
          placeholder="粘贴要抓取的目录页 URL（例如某电商分类页）"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="ui-btn primary" disabled={disabled} onClick={handleFetch}>
          {loading ? "抓取中..." : "抓取目录"}
        </button>

        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} title="预览上限">
          <option value={50}>预览（前 50 条）</option>
          <option value={100}>预览（前 100 条）</option>
          <option value={200}>预览（前 200 条）</option>
        </select>

        <button className="ui-btn" onClick={handleExport}>导出 Excel（.xlsx）</button>
      </div>

      <div
        style={{
          minHeight: 280,
          border: "1px dashed #d9d9d9",
          borderRadius: 8,
          padding: 12,
          background:
            "repeating-linear-gradient(45deg, #fafafa, #fafafa 12px, #f5f5f5 12px, #f5f5f5 24px)",
        }}
      >
        {!preview.length ? (
          <div style={{ color: "#888" }}>
            （占位区域：后续将展示抓取返回的 JSON 简要预览，或转换成表格的展示。）
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
            <thead>
              <tr>
                {["Item No.", "Picture", "Description", "Unit Price", "Link"].map((th) => (
                  <th
                    key={th}
                    style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: "8px 6px" }}
                  >
                    {th}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((it, i) => (
                <tr key={i}>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f5f5f5" }}>{it.sku}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f5f5f5" }}>
                    {it.img ? <a href={it.img} target="_blank" rel="noreferrer">链接</a> : "-"}
                  </td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f5f5f5" }}>{it.title}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f5f5f5" }}>
                    {it.price ? `${it.price}${it.currency ? ` ${it.currency}` : ""}` : "-"}
                  </td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f5f5f5" }}>
                    {it.url ? <a href={it.url} target="_blank" rel="noreferrer">链接</a> : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
