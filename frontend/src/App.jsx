import React, { useMemo, useState } from "react";

/**
 * 读取 API 基座：优先取 ?api=xxx 其后才是 env（本地 vite 预览时可以配 VITE_API_BASE）
 */
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

/** 规范化后端响应，尽最大可能把 items 数组找出来 */
function pickItems(payload) {
  if (Array.isArray(payload)) return payload;

  // 常见几种包装
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload?.data && Array.isArray(payload.data.items)) return payload.data.items;
  if (payload?.result && Array.isArray(payload.result.items)) return payload.result.items;

  // 有些后端会把数据塞在 payload.list / payload.rows 等
  if (payload && Array.isArray(payload.list)) return payload.list;
  if (payload && Array.isArray(payload.rows)) return payload.rows;

  throw new Error("响应格式不正确，items 不是数组。");
}

/** 把任意 item 结构兜底成我们需要的字段 */
function normalizeItem(x = {}) {
  // 尽量容错地取字段
  const title =
    x.title ?? x.name ?? x.productName ?? x.description ?? x.desc ?? "";
  const sku = x.sku ?? x.code ?? x.no ?? x.itemNo ?? x.number ?? "";
  const price =
    x.price ?? x.unitPrice ?? x.minPrice ?? x.salesPrice ?? x.amount ?? "";
  const currency = x.currency ?? x.ccy ?? x.curr ?? "";
  const url = x.url ?? x.link ?? x.href ?? x.detailUrl ?? "";
  const img = x.img ?? x.image ?? x.picture ?? x.imgUrl ?? x.imageUrl ?? x.pic ?? "";

  return { title, sku, price, currency, url, img };
}

/** 生成 .xlsx（固定列：Item No. / Picture / Description / MOQ / Unit Price / Link） */
function exportToXlsx(items, filename = "catalog.xlsx") {
  if (!Array.isArray(items) || !items.length) {
    alert("没有数据可导出。");
    return;
  }
  // 这里我们把图片放成图片 URL（Excel 原生内嵌图片比较复杂，留作后续增强）
  const header = ["Item No.", "Picture", "Description", "MOQ", "Unit Price", "Link"];
  const body = items.map((it) => [
    it.sku || "",
    it.img || "",
    it.title || "",
    "", // MOQ 目前没有，先留空
    (it.price != null && it.price !== "") ? `${it.price}${it.currency ? ` ${it.currency}` : ""}` : "",
    it.url || "",
  ]);

  const aoa = [header, ...body];
  // 全局引入的 SheetJS（在 index.html 里通过 <script src="...xlsx.full.min.js"></script>）
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
}

export default function App() {
  const API_BASE = useApiBase();
  const [url, setUrl] = useState("");
  const [limit, setLimit] = useState(50); // 50 / 100 / 200
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState({ ok: true, msg: "这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。" });
  const [items, setItems] = useState([]);

  const disabled = !API_BASE || loading;

  async function handleFetch() {
    if (!API_BASE) {
      alert("没有 API 基座。请使用 ?api= 后端预览地址访问页面。");
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
      // 统一用 GET，并加上 limit
      const reqUrl = `${API_BASE.replace(/\/+$/, "")}/v1/api/catalog/parse?url=${encodeURIComponent(
        url.trim()
      )}&limit=${encodeURIComponent(String(limit))}`;

      const res = await fetch(reqUrl, {
        // Render 的静态站点拉 API，保持 GET + CORS 默认即可
        method: "GET",
        headers: {
          "X-Lang": (window.i18n && window.i18n.lang) || "zh",
        },
      });

      // 不是 2xx 也尝试读一下文本给出更友好的错误
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        // 不是合法 JSON，直接报错并把片段贴给你看
        throw new Error(`后端未返回 JSON：\n${text.slice(0, 300)}...`);
      }

      // 解析并归一化
      const rawItems = pickItems(json);
      const list = rawItems.map(normalizeItem);

      setItems(list);
      setInfo({
        ok: true,
        msg: `抓取成功：共 ${list.length} 条（预览前 ${limit} 条）`,
      });
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

  // 预览的展示区：只展示前 limit 条（导出时导全部 list）
  const preview = useMemo(() => items.slice(0, limit), [items, limit]);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px" }}>
      <h1 data-i18n="title_app" style={{ margin: "0 0 12px" }}>
        MVP3 — App
      </h1>

      <div
        className={info.ok ? "ui-notice ok" : "ui-notice warn"}
        style={{ marginBottom: 12 }}
      >
        {info.msg}
        {API_BASE ? null : (
          <div style={{ marginTop: 6 }}>
            当前未检测到 API 地址。请使用：
            <code>
              https://你的预览域名/?api=https://你的后端域名
            </code>
          </div>
        )}
      </div>

      <div
        className="ui-notice"
        style={{ marginBottom: 12, background: "#fff4e5" }}
      >
        抓取成功：共 0 条（预览前 {limit} 条）
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          style={{ flex: 1, padding: "8px 10px" }}
          placeholder="粘贴要抓取的目录页 URL（例如某电商分类页）"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          className="ui-btn primary"
          disabled={disabled}
          onClick={handleFetch}
        >
          {loading ? "抓取中..." : "抓取目录"}
        </button>

        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          title="预览上限"
        >
          <option value={50}>预览（前 50 条）</option>
          <option value={100}>预览（前 100 条）</option>
          <option value={200}>预览（前 200 条）</option>
        </select>

        <button className="ui-btn" onClick={handleExport}>
          导出 Excel（.xlsx）
        </button>
      </div>

      {/* 占位区域 / 预览 */}
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
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "#fff",
            }}
          >
            <thead>
              <tr>
                {["Item No.", "Picture", "Description", "Unit Price", "Link"].map(
                  (th) => (
                    <th
                      key={th}
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #eee",
                        padding: "8px 6px",
                      }}
                    >
                      {th}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {preview.map((it, i) => (
                <tr key={i}>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f5f5f5" }}>
                    {it.sku}
                  </td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f5f5f5" }}>
                    {it.img ? (
                      <a href={it.img} target="_blank" rel="noreferrer">
                        链接
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f5f5f5" }}>
                    {it.title}
                  </td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f5f5f5" }}>
                    {it.price ? `${it.price}${it.currency ? ` ${it.currency}` : ""}` : "-"}
                  </td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid #f5f5f5" }}>
                    {it.url ? (
                      <a href={it.url} target="_blank" rel="noreferrer">
                        链接
                      </a>
                    ) : (
                      "-"
                    )}
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
