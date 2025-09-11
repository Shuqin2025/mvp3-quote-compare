import React, { useMemo, useState } from "react";

/**
 * MVP3 – 最小可用版抓取页
 * - 从 URL 读取 ?api= 作为后端基址
 * - 输入目录页 URL，点击按钮 -> fetch 后端 -> 在下方预览 JSON
 * - 所有关键步骤都有 console.log，便于你在 DevTools 里观察
 */

export default function App() {
  // 1) 读取 ?api=（后端基址）
  const API_BASE = useMemo(() => {
    try {
      const u = new URL(window.location.href);
      const v = (u.searchParams.get("api") || "").trim().replace(/\/+$/, "");
      return v;
    } catch {
      return "";
    }
  }, []);

  const [catalogUrl, setCatalogUrl] = useState("");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleScrape = async () => {
    setError("");
    setPreview("");

    if (!API_BASE) {
      setError("缺少 ?api= 后端基址参数，例如 ?api=https://yunivera-mvp2-cwyr.onrender.com");
      console.warn("[mvp3] missing API_BASE (?api=)", API_BASE);
      return;
    }
    if (!catalogUrl) {
      setError("请先在输入框粘贴目录页 URL");
      return;
    }

    // ======= 按你的后端路由改这一行 =======
    // 常见形态：/export?url=、/api/export?url=、/scrape?url=
    const endpoint = `${API_BASE}/export?url=${encodeURIComponent(catalogUrl)}&limit=50`;
    // ====================================

    console.log("[mvp3] fetching:", endpoint);
    setBusy(true);
    try {
      const res = await fetch(endpoint, { method: "GET" });
      console.log("[mvp3] status:", res.status, res.statusText);

      const text = await res.text(); // 先拿纯文本，便于看见服务端报错
      console.log("[mvp3] raw:", text);

      // 尝试解析 JSON（如果不是 JSON 也显示原文，方便排障）
      try {
        const json = JSON.parse(text);
        setPreview(JSON.stringify(json, null, 2));
      } catch {
        setPreview(text);
      }
    } catch (e) {
      console.error("[mvp3] fetch error:", e);
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px" }}>
      {/* 多语言切换按钮（占位） */}
      <div id="langSwitcher" style={{ margin: "1rem 0", display: "flex", gap: 8 }}>
        <button onClick={() => (document.querySelector("[data-i18n='title_app']").textContent = "MVP3 — App")}>
          CN 中文
        </button>
        <button onClick={() => (document.querySelector("[data-i18n='title_app']").textContent = "MVP3 — App (DE)")}>
          DE Deutsch
        </button>
        <button onClick={() => (document.querySelector("[data-i18n='title_app']").textContent = "MVP3 — App (EN)")}>
          GB English
        </button>
      </div>

      <h1 data-i18n="title_app" style={{ margin: "0 0 12px" }}>
        MVP3 — App
      </h1>

      {/* 顶部提示 */}
      <div
        style={{
          background: "#e8f7e9",
          border: "1px solid #93d39a",
          padding: "12px 16px",
          borderRadius: 6,
          marginBottom: 12,
        }}
      >
        <div>这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。</div>
        <div style={{ marginTop: 6 }}>
          当前后端 API 基址：<code>{API_BASE || "(未配置 ?api= …)"}</code>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div
          style={{
            background: "#fdecea",
            border: "1px solid #f5c2c0",
            padding: "10px 12px",
            borderRadius: 6,
            color: "#a40",
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* 输入 + 按钮区 */}
      <div style={{ background: "#fff8e1", border: "1px solid #ecdca2", padding: 12, borderRadius: 6, marginBottom: 18 }}>
        <div style={{ marginBottom: 10, fontWeight: 600 }}>目录抓取（占位）</div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            style={{
              flex: 1,
              padding: "10px 12px",
              border: "1px solid #bbb",
              borderRadius: 6,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            }}
            placeholder="请粘贴要抓取的目录页 URL…"
            value={catalogUrl}
            onChange={(e) => setCatalogUrl(e.target.value)}
          />
          <button onClick={handleScrape} disabled={busy} style={{ padding: "10px 16px" }}>
            {busy ? "抓取中..." : "抓取目录"}
          </button>
        </div>
      </div>

      {/* 结果预览 */}
      <div style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>抓取结果预览区</div>
        <pre
          style={{
            minHeight: 260,
            background:
              preview.trim() === ""
                ? "repeating-linear-gradient(45deg,#fafafa,#fafafa 12px,#f3f3f3 12px,#f3f3f3 24px)"
                : "#0b1020",
            color: preview.trim() === "" ? "#999" : "#e6f3ff",
            border: "1px dashed #ddd",
            borderRadius: 8,
            padding: 16,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {preview || "（等待抓取结果……）"}
        </pre>
      </div>

      <div style={{ marginTop: 22, color: "#666" }}>
        © MVP3 — 页面骨架（占位版）。确认部署稳定后，再逐步接回业务逻辑。
      </div>
    </div>
  );
}
