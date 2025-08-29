import React, { useEffect, useState } from "react";

/**
 * MVP3 完整版 App.jsx
 * - 健康检查
 * - 生成 PDF
 * - 网页抓取 + 一键回填
 * - 预热后端 + 指数退避重试，避免 Render 冷启动 5xx
 */

// ====== 读取后端基址 ======
const API =
  import.meta.env.VITE_API_BASE || "https://yunivera-mvp2.onrender.com/v1/api";

// ====== 工具：预热后端（冷启动常用） ======
async function warmUp() {
  try {
    await fetch(`${API}/health`, { method: "GET", mode: "cors" });
    return true;
  } catch {
    return false;
  }
}

// ====== 工具：带指数退避重试的 GET JSON ======
async function getJSONWithRetry(url, { retries = 3, baseDelay = 600 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { method: "GET", mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      // 退避等待后再试
      await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

// 小工具：确保输入的 URL 含协议
const ensureHttpUrl = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

export default function App() {
  // ====== PDF 表单 ======
  const [title, setTitle] = useState("测试报价单");
  const [content, setContent] = useState("这是由前端调用后端 /v1/api/pdf 生成的 PDF，支持中文。");

  // ====== 抓取 & 回填 ======
  const [fastUrl, setFastUrl] = useState("https://example.com"); // 一键回填输入框
  const [scrapeUrl, setScrapeUrl] = useState("https://example.com"); // 纯 Demo 输入框
  const [scrapeResult, setScrapeResult] = useState(""); // 展示抓取 JSON

  // ====== 健康检查提示（可选：页面加载就预热一次） ======
  const [bootNote, setBootNote] = useState("（如在唤醒后端，可能要 20–60 秒）");
  useEffect(() => {
    // 页面初始轻量预热（不阻塞）
    warmUp().then(() => setBootNote(""));
  }, []);

  // ====== 按钮：后端健康检查 ======
  async function handlePing() {
    try {
      const r = await fetch(`${API}/health`, { method: "GET", mode: "cors" });
      const j = await r.json().catch(() => ({}));
      alert(`[PING] ${JSON.stringify(j)}`);
    } catch (e) {
      alert(`[PING] 失败：${e.message}`);
    }
  }

  // ====== 按钮：生成 PDF ======
  async function handleGeneratePdf() {
    try {
      // 先预热
      await warmUp();

      const res = await fetch(`${API}/pdf`, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "quote.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // 也可以在页面上提示
      // alert("PDF 已生成并下载。");
    } catch (e) {
      alert(`生成失败：${e.message}`);
    }
  }

  // ====== 按钮：抓取（演示 + 在下方输出 JSON） ======
  async function handleScrapeDemo() {
    const raw = (scrapeUrl || "").trim();
    if (!raw) {
      alert("请输入网址");
      return;
    }

    setScrapeResult(`⏳ 正在唤醒后端...`);
    await warmUp();

    const target = ensureHttpUrl(raw);
    const reqUrl = `${API}/scrape?url=${encodeURIComponent(target)}`;
    setScrapeResult(`⏳ 抓取中...\nGET ${reqUrl}`);

    try {
      const data = await getJSONWithRetry(reqUrl, { retries: 3, baseDelay: 800 });
      setScrapeResult(
        `Title: ${data.title}\n描述: ${data.description || "(无)"}\nH1: ${
          data.h1?.join(" | ") || "(无)"
        }\n来源: ${data.url}\n\n完整数据:\n` + JSON.stringify(data, null, 2)
      );
    } catch (e) {
      alert(`抓取失败：${e.message}`);
      setScrapeResult(`❌ 抓取失败：${e.message}\nURL = ${reqUrl}`);
    }
  }

  // ====== 按钮：一键回填（把抓取结果写入标题 + 正文开头） ======
  async function handleOneClickFill() {
    const raw = (fastUrl || "").trim();
    if (!raw) {
      alert("请输入网址");
      return;
    }

    await warmUp();

    const target = ensureHttpUrl(raw);
    const reqUrl = `${API}/scrape?url=${encodeURIComponent(target)}`;

    try {
      const data = await getJSONWithRetry(reqUrl, { retries: 3, baseDelay: 800 });

      // 回填标题（若抓到的 title 有值）
      if (data.title) setTitle(data.title);

      // 组合一段摘要 + H1，写到正文开头
      const lines = [];
      if (data.description) lines.push(data.description);
      if (data.h1?.length) lines.push("H1: " + data.h1.join(" | "));
      const snippet = lines.length ? lines.join("\n") + "\n\n" : "";

      setContent((prev) => (snippet ? snippet + prev : prev));

      alert("已回填抓取结果");
    } catch (e) {
      alert(`一键回填失败：${e.message}`);
    }
  }

  return (
    <div style={{ padding: "14px", fontFamily: "sans-serif" }}>
      <h2>MVP3：前端调用 /v1/api/pdf + 抓取回填 Demo</h2>

      {/* ====== PDF 生成区域 ====== */}
      <div style={{ marginBottom: 16 }}>
        <div>
          <label>
            标题：{" "}
            <input
              style={{ width: 320 }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
        </div>

        <div>
          <label>正文：</label>
          <br />
          <textarea
            style={{ width: 520, height: 120 }}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div style={{ margin: "8px 0" }}>
          <button onClick={handlePing}>后端健康检查</button>{" "}
          <button onClick={handleGeneratePdf}>生成 PDF</button>
        </div>

        <div style={{ color: "#666" }}>
          API_BASE = <code>{API}</code>
        </div>
      </div>

      {/* ====== 抓取 & 一键回填 ====== */}
      <div style={{ borderTop: "1px solid #ddd", paddingTop: 12, marginTop: 12 }}>
        <h3>🔎 网页抓取 & 一键回填</h3>
        <div style={{ marginBottom: 8 }}>
          <input
            id="scrape-fast-url"
            style={{ width: 320 }}
            value={fastUrl}
            onChange={(e) => setFastUrl(e.target.value)}
            placeholder="https://example.com"
          />{" "}
          <button onClick={handleOneClickFill}>回填</button>{" "}
          <span style={{ color: "#999" }}>{bootNote}</span>
        </div>
      </div>

      {/* ====== 纯抓取演示（下方显示 JSON） ====== */}
      <div style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 12 }}>
        <h3>🧪 网页抓取 Demo (/v1/api/scrape)</h3>
        <div style={{ marginBottom: 8 }}>
          <input
            style={{ width: 520 }}
            value={scrapeUrl}
            onChange={(e) => setScrapeUrl(e.target.value)}
            placeholder="https://example.com"
          />{" "}
          <button onClick={handleScrapeDemo}>抓取</button>
        </div>

        <pre
          id="scrape-result"
          style={{
            background: "#f8f8f8",
            border: "1px solid #ddd",
            minHeight: 160,
            whiteSpace: "pre-wrap",
            padding: 8,
          }}
        >
          {scrapeResult}
        </pre>
      </div>
    </div>
  );
}
