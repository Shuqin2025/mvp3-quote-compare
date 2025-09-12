import React, { useEffect, useMemo, useState } from "react";

/**
 * MVP3 — 目录抓取（预览 & 导出 Excel）
 * - 方案 A：前端只负责展示和导出；真正抓取由后端完成
 * - API_BASE 解析优先级：
 *   1) URL ?api=... 覆盖
 *   2) import.meta.env.VITE_API_BASE （Render 环境变量）
 *   3) import.meta.env.VITE_API_URL  （兜底）
 */

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

const PREVIEW_SIZES = [10, 20, 50, 100];

export default function App() {
  // 输入、状态
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  // 数据
  const [items, setItems] = useState([]); // 统一为 [{title, sku, price, currency, url, img}, ...]
  const [total, setTotal] = useState(0);
  // 预览数量
  const [previewCount, setPreviewCount] = useState(50);

  // 列选项（是否导出这些列）
  const [incItemNo, setIncItemNo] = useState(true);      // 货号 / sku
  const [incPicture, setIncPicture] = useState(true);    // 图片链接
  const [incDesc, setIncDesc] = useState(true);          // 描述 / title
  const [incMOQ, setIncMOQ] = useState(false);           // MOQ（无则留空）
  const [incUnitPrice, setIncUnitPrice] = useState(true);// 单价
  const [incLink, setIncLink] = useState(true);          // 详情链接

  // 仅用于页面右上角小提示
  useEffect(() => {
    if (window.i18n?.setLang) {
      // 初次加载时保持按钮不报错
    }
    if (window?.uiEnhance?.mounted === undefined) {
      console.log("[ui-enhance] v3 loaded (stub)");
    }
    console.log("[mvp3] App loaded. API_BASE =", API_BASE || "(empty)");
    if (!API_BASE) {
      console.warn("[mvp3] API_BASE is empty. Please open the preview with ?api=https://your-backend.onrender.com");
    }
  }, []);

  const normItems = useMemo(() => {
    // 后端返回结构容错：可能是 {items} / {data:{items}} / {list} / 直接数组
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

  const previewList = useMemo(() => normItems.slice(0, previewCount), [normItems, previewCount]);

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
      // 约定：后端接口：GET /v1/api/catalog/parse?url=<目录页>
      const api = `${API_BASE}/v1/api/catalog/parse?url=${encodeURIComponent(u)}`;
      const res = await fetch(api, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // 兼容几种字段名
      const list = data?.items || data?.data?.items || data?.list || data;
      const total = data?.total ?? data?.data?.total ?? (Array.isArray(list) ? list.length : 0);
      if (!Array.isArray(list)) throw new Error("响应格式不正确，items 不是数组。");

      setItems(list);
      setTotal(total);
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

  function exportXlsx() {
    if (!window.XLSX) {
      alert("导出失败：未加载 XLSX 库。");
      return;
    }
    const rows = [];
    // 旧模板顺序：Item No. | Picture | Description | MOQ | Unit Price | Link
    previewList.forEach((x) => {
      const row = {};
      if (incItemNo) row["Item No."] = x.sku || "";
      if (incPicture) row["Picture"] = x.img || "";
      if (incDesc) row["Description"] = x.title || "";
      if (incMOQ) row["MOQ"] = ""; // 当前无数据来源，留空
      if (incUnitPrice) {
        // 单元格写入 “€ 0,00” 会被 Excel 解析为文本；数值留空或原样
        const price = x.price ?? "";
        const symbol = x.currency ?? "";
        row["Unit Price"] = symbol && price ? `${symbol} ${price}` : `${price}`;
      }
      if (incLink) row["Link"] = x.url || "";
      rows.push(row);
    });

    // 兜底：若用户把所有列都关了，至少导出 Description
    if (rows.length && Object.keys(rows[0]).length === 0) {
      rows.forEach((r, i) => (rows[i] = { Description: previewList[i]?.title || "" }));
    }

    const ws = window.XLSX.utils.json_to_sheet(rows, { skipHeader: false });
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "catalog-preview");

    const ts = new Date();
    const pad = (n) => (n < 10 ? "0" + n : "" + n);
    const file =
      `catalog-preview-${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}-${pad(ts.getHours())}${pad(
        ts.getMinutes()
      )}${pad(ts.getSeconds())}.xlsx`;

    window.XLSX.writeFile(wb, file);
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px" }}>
      <h1 data-i18n="title_app" style={{ margin: "0 0 12px" }}>MVP3 — App</h1>

      {/* 顶部提示 */}
      <div
        style={{
          background: "#e8f7d2",
          border: "1px solid #bce08a",
          padding: "12px 14px",
          borderRadius: 6,
          marginBottom: 12,
        }}
      >
        这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。
      </div>

      {/* 抓取结果小条 */}
      <div
        style={{
          background: "#fff7e6",
          border: "1px solid #ffd591",
          padding: "10px 12px",
          borderRadius: 6,
          marginBottom: 12,
          color: "#b36b00",
        }}
      >
        抓取成功：共 {total || 0} 条（预览前 {previewCount} 条）
      </div>

      {/* 表单区 */}
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

      {/* 列选项 */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px 18px",
          border: "1px dashed #ddd",
          padding: "10px 12px",
          borderRadius: 6,
          marginBottom: 12,
        }}
      >
        <strong>导出列：</strong>
        <label><input type="checkbox" checked={incItemNo}   onChange={(e) => setIncItemNo(e.target.checked)} /> 货号 (Item No.)</label>
        <label><input type="checkbox" checked={incPicture}  onChange={(e) => setIncPicture(e.target.checked)} /> 图片 (Picture)</label>
        <label><input type="checkbox" checked={incDesc}     onChange={(e) => setIncDesc(e.target.checked)} /> 描述 (Description)</label>
        <label><input type="checkbox" checked={incMOQ}      onChange={(e) => setIncMOQ(e.target.checked)} /> MOQ</label>
        <label><input type="checkbox" checked={incUnitPrice} onChange={(e) => setIncUnitPrice(e.target.checked)} /> 单价 (Unit Price)</label>
        <label><input type="checkbox" checked={incLink}     onChange={(e) => setIncLink(e.target.checked)} /> 链接 (Link)</label>
      </div>

      {/* 错误提示 */}
      {err ? (
        <div style={{ color: "#c00", marginBottom: 10 }}>
          {err}
        </div>
      ) : null}

      {/* 结果表格（预览） */}
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
                  <td>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noreferrer">
                        链接
                      </a>
                    ) : (
                      ""
                    )}
                  </td>
                  <td>
                    {r.img ? (
                      <a href={r.img} target="_blank" rel="noreferrer">
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
        )}
      </div>

      <div style={{ color: "#777", marginTop: 12, fontSize: 12 }}>
        © MVP3 — 页面骨架（占位版）。确认部署稳定后，将逐步接回业务逻辑。
      </div>
    </div>
  );
}
