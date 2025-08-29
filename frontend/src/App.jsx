import React, { useState, useRef } from "react";

/** 统一后端基址：
 *  1) 优先 .env 的 VITE_API_BASE（应包含 /v1/api）
 *  2) 否则用 VITE_API_URL（仅主机），并补上 /v1/api
 *  3) 否则回退到 yunivera-mvp2 的统一后端
 */
function resolveApiBase() {
  const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
  const base = env.VITE_API_BASE?.trim();
  const host = env.VITE_API_URL?.trim();
  if (base) return base.replace(/\/+$/, ""); // 去尾斜杠
  if (host) return host.replace(/\/+$/, "") + "/v1/api";
  return "https://yunivera-mvp2.onrender.com/v1/api";
}
const API_BASE = resolveApiBase();

/** 通用：带超时与重试 */
async function fetchJSONWithRetry(url, init = {}, retries = 1, timeoutMs = 45000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      const r = await fetch(url, { ...init, signal: ac.signal, cache: "no-store" });
      clearTimeout(timer);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise((res) => setTimeout(res, 1200));
    }
  }
}

export default function App() {
  // === 原有：PDF Demo ===
  const [title, setTitle] = useState("测试报价单");
  const [content, setContent] = useState("这是由前端调用后端 /v1/api/pdf 生成的 PDF，支持中文。");
  const [msg, setMsg] = useState("就绪。");

  async function checkHealth() {
    try {
      setMsg("后端健康检查中……（首次可能唤醒实例，需 20–60 秒）");
      const json = await fetchJSONWithRetry(`${API_BASE}/health?ts=${Date.now()}`, { method: "GET" }, 1, 45000);
      setMsg(`健康检查成功：${JSON.stringify(json)}`);
      alert(`[PING] ${JSON.stringify(json)}`);
    } catch (e) {
      console.error(e);
      setMsg("健康检查失败：Failed to fetch（可能冷启动或瞬断）");
      alert("[PING-ERR] Failed to fetch");
    }
  }

  async function generatePDF() {
    try {
      setMsg("开始生成 PDF …");
      const r = await fetch(`${API_BASE}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      // 兼容两种返回：
      // 1) 直接返回 application/pdf → Blob 下载
      // 2) 返回 JSON { fileUrl: "/files/xxx.pdf" } → 新窗口打开
      const ct = r.headers.get("content-type") || "";
      if (ct.includes("application/pdf")) {
        const blob = await r.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "quote.pdf";
        a.click();
        setMsg("PDF 已生成并下载（Blob）。");
        return;
      }

      let data = {};
      try { data = await r.json(); } catch {}
      if (!r.ok) {
        const msg = `HTTP ${r.status}${data?.error ? " - " + data.error : ""}`;
        throw new Error(msg);
      }
      if (data?.fileUrl) {
        const baseHost = API_BASE.replace(/\/v1\/api\/?$/, "");
        window.open(`${baseHost}${data.fileUrl}`, "_blank");
        setMsg("PDF 已生成并在新窗口打开（JSON fileUrl）。");
      } else {
        setMsg("已生成，但后端未返回文件地址。");
        alert("已生成，但未返回文件地址");
      }
    } catch (e) {
      console.error(e);
      setMsg("生成失败：Failed to fetch / 或后端错误");
      alert("生成失败：" + (e.message || "Failed to fetch"));
    }
  }

  // === 新增：抓取 + 一键回填（回填到 标题/正文） ===
  const [rawUrl, setRawUrl] = useState("https://example.com");
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeData, setScrapeData] = useState(null);
  const iframeRef = useRef(null);

  async function doScrape() {
    if (!rawUrl.trim()) return alert("请先输入 URL");
    setScrapeLoading(true);
    setScrapeData(null);
    if (iframeRef.current) iframeRef.current.removeAttribute("srcdoc");

    try {
      const res = await fetch(`${API_BASE}/scrape?url=${encodeURIComponent(rawUrl)}`, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setScrapeData(data);
      if (data?.preview && iframeRef.current) {
        iframeRef.current.srcdoc = `<base href="${data.url}">${data.preview}`;
      }
    } catch (e) {
      alert("抓取失败：" + e.message);
      console.error(e);
    } finally {
      setScrapeLoading(false);
    }
  }

  // 一键回填：把抓取结果写到 标题/正文
  function applyTitle() {
    if (!scrapeData) return alert("请先抓取成功再回填标题");
    const bestTitle = scrapeData.title || (Array.isArray(scrapeData.h1) && scrapeData.h1[0]) || "";
    setTitle(bestTitle || "（未捕获标题）");
  }

  function applyContent() {
    if (!scrapeData) return alert("请先抓取成功再回填正文");
    const lines = [];
    const bestTitle = scrapeData.title || (Array.isArray(scrapeData.h1) && scrapeData.h1[0]) || "";
    if (bestTitle) lines.push(`标题：${bestTitle}`);
    if (Array.isArray(scrapeData.h1) && scrapeData.h1.length) lines.push(`H1：${scrapeData.h1.join(" | ")}`);
    if (scrapeData.description) lines.push(`摘要：${scrapeData.description}`);
    if (scrapeData.price != null) {
      const priceLine = `价格：${scrapeData.price}${scrapeData.currency ? " " + scrapeData.currency : ""}`;
      lines.push(priceLine);
    }
    if (scrapeData.sku) lines.push(`SKU：${scrapeData.sku}`);
    if (scrapeData.moq != null) lines.push(`MOQ：${scrapeData.moq}`);
    if (scrapeData.url) lines.push(`来源：${scrapeData.url}`);
    lines.push("");
    lines.push("（以上为自动抓取生成的摘要，可在生成 PDF 前进行手工编辑。）");
    setContent(lines.join("\n"));
  }

  function applyBoth() {
    applyTitle();
    applyContent();
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial, system-ui, -apple-system" }}>
      <h2>MVP3: 前端调用 /v1/api/pdf + 抓取回填 Demo</h2>

      {/* PDF 输入区 */}
      <div style={{ marginBottom: 10 }}>
        <label>标题：</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: 420 }} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label>正文：</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ width: 620, height: 140 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <button onClick={checkHealth} style={{ marginRight: 10 }}>
          后端健康检查
        </button>
        <button onClick={generatePDF}>生成 PDF</button>
      </div>

      <div style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
        API_BASE = <code>{API_BASE}</code>
      </div>

      {/* 抓取 + 回填 */}
      <hr />
      <h3 style={{ marginTop: 16 }}>🔎 网页抓取 & 一键回填</h3>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <input
          style={{ width: 420 }}
          placeholder="输入要抓取的 URL，例如 https://example.com"
          value={rawUrl}
          onChange={(e) => setRawUrl(e.target.value)}
        />
        <button onClick={doScrape} disabled={scrapeLoading}>
          {scrapeLoading ? "抓取中…" : "抓取"}
        </button>
        <button onClick={applyTitle} disabled={!scrapeData}>回填标题</button>
        <button onClick={applyContent} disabled={!scrapeData}>回填正文</button>
        <button onClick={applyBoth} disabled={!scrapeData}>标题+正文</button>
      </div>

      {scrapeData && (
        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <b>Title：</b>{scrapeData.title || "(无)"}　　
            <b>描述：</b>{scrapeData.description || "(无)"}　　
            <b>H1：</b>{(scrapeData.h1 || []).join(" / ") || "(无)"}　　
            <b>SKU：</b>{scrapeData.sku ?? "(无)"}　　
            <b>Price：</b>{scrapeData.price ?? "(无)"} {scrapeData.currency ?? ""}
            <b style={{ marginLeft: 12 }}>MOQ：</b>{scrapeData.moq ?? "(无)"}
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <iframe
              ref={iframeRef}
              title="preview"
              style={{ width: 600, height: 420, border: "1px solid #ddd" }}
            />
            <pre
              style={{
                flex: 1,
                minHeight: 420,
                padding: 12,
                background: "#f7f7f7",
                borderRadius: 6,
                overflow: "auto",
              }}
            >
              {JSON.stringify(scrapeData, null, 2)}
            </pre>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, padding: 10, background: "#f5f5f5", borderRadius: 6 }}>
        {msg}
      </div>
    </div>
  );
}
