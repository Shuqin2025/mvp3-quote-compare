import React, { useEffect, useMemo, useState } from "react";

/** 解析后端 API 基础地址：优先 ?api=…，其次 VITE_API_BASE/VITE_API_URL */
function getApiBase() {
  try {
    const u = new URL(window.location.href);
    const p = (u.searchParams.get("api") || "").trim();
    if (p) return p.replace(/\/+$/, "");
  } catch {}
  const envA = (import.meta.env?.VITE_API_BASE || "").trim();
  const envB = (import.meta.env?.VITE_API_URL || "").trim();
  return (envA || envB || "").replace(/\/+$/, "");
}
const API_BASE = getApiBase();

/** 预览条数选项（默认 100） */
const PREVIEW_SIZES = [50, 100, 200, 500];

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [items, setItems] = useState([]); // [{title, sku, price, currency, url, img}]
  const [total, setTotal] = useState(0);

  const [previewCount, setPreviewCount] = useState(100); // 默认 100

  useEffect(() => {
    console.log("[mvp3] App loaded. API_BASE =", API_BASE || "(empty)");
    if (!API_BASE) {
      console.warn(
        "[mvp3] API_BASE is empty. Use a preview URL like: ?api=https://yunivera-mvp2-cwyr.onrender.com"
      );
    }
  }, []);

  /** 统一字段名 */
  const normItems = useMemo(() => {
    const arr =
      (Array.isArray(items) ? items : []) ||
      (Array.isArray(items?.items) ? items.items : []) ||
      (Array.isArray(items?.data?.items) ? items.data.items : []) ||
      (Array.isArray(items?.list) ? items.list : []);
    return arr.map((x) => ({
      title: `${x.title ?? x.name ?? ""}`.trim(),
      sku: `${x.sku ?? x.itemNo ?? x.code ?? ""}`.trim(),
      price: x.price ?? "",
      currency: x.currency ?? "",
      url: x.url ?? x.link ?? "",
      img: x.img ?? x.image ?? "",
    }));
  }, [items]);

  const previewList = useMemo(
    () => normItems.slice(0, previewCount),
    [normItems, previewCount]
  );

  async function handleFetch() {
    setErr("");

    if (!API_BASE) {
      setErr("未设置后端 API 地址，请使用带 ?api=... 的预览链接打开本页。");
      alert("抓取失败：未设置后端 API；请改用带 ?api=... 的预览链接。");
      return;
    }
    const u = (url || "").trim();
    if (!u) {
      setErr("请先粘贴要抓取的目录页 URL。");
      alert("请先粘贴要抓取的目录页 URL。");
      return;
    }

    setLoading(true);
    try {
      const api = `${API_BASE}/v1/api/catalog/parse?url=${encodeURIComponent(u)}`;
      console.log("[mvp3] fetch =>", api);
      const res = await fetch(api, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const list = data?.items || data?.data?.items || data?.list || data;
      const ttl = data?.total ?? data?.data?.total ?? (Array.isArray(list) ? list.length : 0);
      if (!Array.isArray(list)) throw new Error("响应格式不正确，items 不是数组。");

      setItems(list);
      setTotal(ttl);
    } catch (e) {
      console.error("[mvp3] fetch error:", e);
      setItems([]);
      setTotal(0);
      setErr(`抓取失败：${e?.message || e}`);
      alert("抓取失败，请换个页面再试。");
    } finally {
      setLoading(false);
    }
  }

  /** 导出固定列为 .xlsx：Item No. | Picture | Description | MOQ | Unit Price | Link */
  function exportXlsx() {
    if (!window.XLSX) {
      alert("导出失败：未加载 XLSX 库。");
      return;
    }
    const rows = previewList.map((x) => {
      const price = x.price ?? "";
      const symbol = x.currency ?? "";
      return {
        "Item No.": x.sku || "",
        "Picture": x.img || "",
        "Description": x.title || "",
        "MOQ": "",
        "Unit Price": symbol && price ? `${symbol} ${price}` : `${price}`,
        "Link": x.url || "",
      };
    });

    const ws = window.XLSX.utils.json_to_sheet(rows, { skipHeader: false });
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "catalog-preview");

    const ts = new Date();
    const pad = (n) => (n < 10 ? "0" + n : "" + n);
    const fname = `catalog-preview-${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(
      ts.getDate()
    )}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.xlsx`;
    window.XLSX.writeFile(wb, fname);
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px" }}>
      <h1 data-i18n="title_app" style={{ margin: "0 0 12px" }}>MVP3 — App</h1>

      <div style={{ background: "#e8f7d2", border: "1px solid #bce08a", padding: "12px 14px", borderRadius: 6, marginBottom: 12 }}>
        这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。
      </div>

      <div style={{ background: "#fff7e6", border: "1px solid #ffd591", padding: "10px 12px", borderRadius: 6, marginBottom: 12, color: "#b36b00" }}>
        抓取成功：共 {total || 0} 条（预览前 {previewCount} 条）
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="粘贴要抓取的目录页 URL（例如某电商分类页）"
          style={{ flex: 1, height: 36, padding: "0 10px", border: "1px solid #ddd", borderRadius: 6 }}
        />
        <button disabled={loading} onClick={handleFetch} className="btn-primary">
          {loading ? "抓取中..." : "抓取目录"}
        </button>

        <select
          value={previewCount}
          onChange={(e) => setPreviewCount(Number(e.target.value))}
          title="仅影响页面预览条数，不影响导出"
        >
          {PREVIEW_SIZES.map((n) => (
            <option key={n} value={n}>
              预览（前 {n} 条）
            </option>
          ))}
        </select>

        <button onClick={exportXlsx} title="导出当前预览为 .xlsx 文件">
          导出 Excel（.xlsx）
        </button>
      </div>

      {err ? <div style={{ color: "#c00", marginBottom: 10 }}>{err}</div> : null}

      <div
        style={{
          border: "1px dashed #ddd",
          padding: "12px",
          borderRadius: 6,
          minHeight: 260,
          background:
            "repeating-linear-gradient(45deg, #fafafa 0, #fafafa 10px, #f3f3f3 10px, #f3f3f3 20px)",
        }}
      >
        {previewList.length === 0 ? (
          <div style={{ color: "#999" }}>（占位区域：后续将展示抓取返回的 JSON 简要预览，或转换成表格的展示。）</div>
        ) : (
          <table width="100%" cellPadding={6} style={{ background: "#fff", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafafa" }}>
                <th align="left">title</th>
                <th align="left">sku</th>
                <th align="left">price</th>
                <th align="left">currency</th>
                <th align="left">url</th>
                <th align="left">img</th>
              </tr>
            </thead>
            <tbody>
              {previewList.map((r, idx) => (
                <tr key={idx} style={{ borderTop: "1px solid #f0f0f0" }}>
                  <td>{r.title || ""}</td>
                  <td>{r.sku || ""}</td>
                  <td>{r.price ?? ""}</td>
                  <td>{r.currency ?? ""}</td>
                  <td>{r.url ? <a href={r.url} target="_blank" rel="noreferrer">链接</a> : ""}</td>
                  <td>{r.img ? <a href={r.img} target="_blank" rel="noreferrer">链接</a> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ color: "#777", marginTop: 12, fontSize: 12 }}>
        © MVP3 — 页面骨架（占位版）。确认部署稳定后，将逐步接回业务逻辑。
      </div>
    </div>
  );
}
