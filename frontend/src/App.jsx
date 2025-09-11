import React, { useEffect, useMemo, useState } from "react";

/**
 * MVP3 — 升级占位壳（接入抓取 + 预览 + 导出CSV）
 * - API_BASE 读取顺序：URL ?api=xxx > import.meta.env.VITE_API_BASE > ""
 * - 按钮：抓取目录（启用）、预览（只显示前 50 条）、导出 Excel（CSV 版本）、生成 PDF（禁用）
 * - 与 public/i18n.js、lang-fetch.js、ui-enhance.js 共存
 */

export default function App() {
  // 1) 解析 API 基址
  const API_BASE = useMemo(() => {
    try {
      const u = new URL(window.location.href);
      const q = u.searchParams.get("api")?.trim() ?? "";
      const env1 = import.meta?.env?.VITE_API_BASE?.trim?.() ?? "";
      return q || env1 || "";
    } catch {
      const env1 = import.meta?.env?.VITE_API_BASE?.trim?.() ?? "";
      return env1 || "";
    }
  }, []);

  // 2) 本页状态
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");        // 顶部提示（成功/错误）
  const [url, setUrl] = useState("");          // 目录页 URL 输入
  const [raw, setRaw] = useState(null);        // 后端返回的原始 JSON
  const [preview, setPreview] = useState([]);  // 预览数组（最多 50 条）

  // 3) ui-enhance 开发者 UI/语言切换挂载（与旧脚本配合）
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try { window.uiEnhance?.mount?.(); } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // 4) 发起抓取
  async function onFetchCatalog() {
    setHint("");
    if (!API_BASE) {
      setHint("未配置 API_BASE：请在 URL 上加 ?api=https://你的域名 或设置 VITE_API_BASE。");
      return;
    }
    if (!url.trim()) {
      setHint("请先输入要抓取的目录页 URL。");
      return;
    }

    const endpoint = `${API_BASE.replace(/\/+$/,"")}/v1/api/catalog/parse?url=${encodeURIComponent(
      url.trim()
    )}`;

    setBusy(true);
    try {
      const res = await fetch(endpoint, { method: "GET" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setRaw(data);

      // 兼容常见结构：{ ok: true, products: [...] }
      const arr = Array.isArray(data?.products) ? data.products : Array.isArray(data) ? data : [];
      const top50 = arr.slice(0, 50);
      setPreview(top50);

      setHint(`抓取成功：共 ${arr.length} 条（预览前 50 条）`);
    } catch (err) {
      console.error(err);
      setRaw(null);
      setPreview([]);
      setHint(`抓取失败：${err.message || "Unknown error"}`);
    } finally {
      setBusy(false);
    }
  }

  // 5) 导出 CSV（简版 Excel）
  function onExportCSV() {
    if (!preview.length) {
      setHint("没有可导出的数据，请先抓取。");
      return;
    }

    // 选取预览对象的公共字段
    const fields = pickColumns(preview);
    const rows = [fields.join(",")];
    for (const item of preview) {
      const line = fields
        .map((k) => {
          let v = item?.[k];
          if (v == null) v = "";
          // 避免逗号/换行破坏 CSV
          const s = String(v).replace(/\r?\n/g, " ").replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(",");
      rows.push(line);
    }
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `catalog-preview-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function pickColumns(list) {
    // 尝试识别常见字段
    const candidates = [
      "title","name","sku","price","currency","url","img","preview","source"
    ];
    const first = list[0] || {};
    const keys = Object.keys(first);
    const picked = candidates.filter((k) => keys.includes(k));
    // 没命中就取前 6 个字段兜底
    return picked.length ? picked : keys.slice(0, 6);
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px" }}>
      {/* 标题 */}
      <h1 data-i18n="title_app" style={{ margin: "0 0 12px" }}>
        MVP3 — App
      </h1>

      {/* 页面说明条 */}
      <div
        style={{
          background: "#eaf9e6",
          border: "1px solid #b5e5a1",
          padding: "10px 12px",
          borderRadius: 6,
          color: "#2a6120",
          marginBottom: 16,
        }}
      >
        这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。
      </div>

      {/* 顶部提示（抓取成功/失败） */}
      {!!hint && (
        <div
          style={{
            background: "#fffceb",
            border: "1px solid #ffe58f",
            padding: "8px 12px",
            borderRadius: 6,
            color: "#8b6d00",
            marginBottom: 12,
          }}
        >
          {hint}
        </div>
      )}

      {/* 工具条 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <strong>目录抓取（占位）</strong>
      </div>

      {/* 操作行 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="粘贴要抓取的目录页 URL（例如某电商分类页）"
          style={{
            flex: 1,
            minWidth: 260,
            padding: "8px 10px",
            border: "1px solid #d9d9d9",
            borderRadius: 6,
          }}
        />
        <button
          onClick={onFetchCatalog}
          disabled={busy}
          className="btn btn-primary"
          style={btnPrimary}
        >
          {busy ? "抓取中…" : "抓取目录"}
        </button>
        <button disabled className="btn" title="预览会在下方展示，按钮仅为引导" style={btn}>
          预览（前 50 条）
        </button>
        <button onClick={onExportCSV} disabled={!preview.length} className="btn" style={btn}>
          导出 Excel
        </button>
        <button disabled className="btn" title="稍后接回 PDF 生成功能" style={btn}>
          生成 PDF
        </button>
      </div>

      {/* 预览卡片 */}
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8 }}>抓取结果预览区</div>
        {!preview.length ? (
          <EmptyStripe />
        ) : (
          <PreviewTable list={preview} />
        )}
      </div>

      <div style={{ color: "#888" }}>
        © MVP3 — 页面骨架（占位版）。确认部署稳定后，将逐步接回业务逻辑。
      </div>
    </div>
  );
}

/** 斜纹空状态 */
function EmptyStripe() {
  return (
    <div
      style={{
        height: 260,
        border: "1px dashed #ddd",
        borderRadius: 8,
        background:
          "repeating-linear-gradient(-45deg, #fafafa, #fafafa 10px, #f2f2f2 10px, #f2f2f2 20px)",
      }}
    />
  );
}

/** 简易预览表（最多显示前 50 条、最多 6 列） */
function PreviewTable({ list }) {
  const columns = pickColumns(list);

  function pickColumns(arr) {
    const candidates = [
      "title","name","sku","price","currency","url","img","preview","source"
    ];
    const keys = Object.keys(arr[0] || {});
    const picked = candidates.filter((k) => keys.includes(k));
    return (picked.length ? picked : keys.slice(0, 6)).slice(0, 6);
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} style={thtd(true)}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c} style={thtd()}>
                  {renderCell(row?.[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ color: "#999", marginTop: 8 }}>仅展示前 50 条。</div>
    </div>
  );
}

function renderCell(v) {
  if (v == null) return "";
  const s = String(v);
  if (/^https?:\/\//i.test(s)) {
    return (
      <a href={s} target="_blank" rel="noreferrer">
        链接
      </a>
    );
  }
  return s.length > 120 ? s.slice(0, 117) + "..." : s;
}

const btnPrimary = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #1677ff",
  background: "#1677ff",
  color: "#fff",
  cursor: "pointer",
};

const btn = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #d9d9d9",
  background: "#fff",
  cursor: "pointer",
};
