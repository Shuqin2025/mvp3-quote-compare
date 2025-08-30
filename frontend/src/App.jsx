import { useState } from "react";

// ① API 基址：优先读 .env 里的 VITE_API_BASE；否则回落到 MVP2 后端
const API_BASE =
  (import.meta?.env && import.meta.env.VITE_API_BASE) ||
  "https://yunivera-mvp2.onrender.com/v1/api";

// 基础样式
const box = {
  maxWidth: 980,
  margin: "16px auto",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  lineHeight: 1.55,
  fontSize: 14,
};
const row = { margin: "8px 0" };
const input = { width: "100%", padding: "6px 8px" };
const textarea = {
  width: "100%",
  height: 150,
  padding: "8px",
  whiteSpace: "pre-wrap",
};
const btn = {
  padding: "6px 10px",
  marginRight: 8,
  cursor: "pointer",
};
const hint = { color: "#666", fontSize: 12 };

export default function App() {
  // 顶部报价单
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Bereit. / 就绪。");

  // 中部抓取区
  const [scrapeUrl, setScrapeUrl] = useState("https://example.com");
  const [scrapeJson, setScrapeJson] = useState("");

  // 底部 demo
  const [demoUrl, setDemoUrl] = useState("https://example.com");
  const [demoOut, setDemoOut] = useState("");

  /** 健康检查 */
  const checkHealth = async () => {
    try {
      const r = await fetch(`${API_BASE}/health`);
      const j = await r.json();
      setStatus(`[PING] ${r.status} ${r.statusText} | OK`);
      console.log("health:", j);
      alert(`[PING] ${r.status} ${r.statusText}`);
    } catch (e) {
      console.error(e);
      setStatus("Backend 不可用 ❌");
      alert("后端不可用 / Backend unavailable");
    }
  };

  /** 生成 PDF */
  const generatePdf = async () => {
    if (!title && !text) {
      alert("请先填写 标题/正文（或先抓取后回填）");
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: text }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "quote.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("PDF 生成失败：" + e.message);
    }
  };

  /** 抓取 */
  const doScrape = async () => {
    if (!scrapeUrl.trim()) return;
    setScrapeJson("抓取中…");
    try {
      const r = await fetch(
        `${API_BASE}/scrape?url=${encodeURIComponent(scrapeUrl)}`
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setScrapeJson(JSON.stringify(j, null, 2));
    } catch (e) {
      console.error(e);
      setScrapeJson("抓取失败: " + e.message);
    }
  };

  /** 回填（基础：title/preview） */
  const fillBasic = () => {
    try {
      const obj = JSON.parse(scrapeJson || "{}");
      if (obj.title) setTitle(String(obj.title));
      if (obj.preview) setText(String(obj.preview));
      else if (obj.description) setText(String(obj.description));
      else alert("抓取结果中未发现可回填的正文（preview/description）。");
    } catch {
      alert("当前抓取结果不是合法 JSON。");
    }
  };

  /** 智能回填（含 价格/货币/SKU/MOQ）+ 简易规则 */
  const fillSmart = () => {
    try {
      const d = JSON.parse(scrapeJson || "{}");
      const parts = [];

      if (d.title) parts.push(`【产品】${d.title}`);
      if (d.vendor) parts.push(`【卖家】${d.vendor}`);
      if (d.price ?? null) {
        const cur = d.currency || "";
        parts.push(`【价格】${d.price}${cur ? " " + cur : ""}`);
      }
      if (d.sku) parts.push(`【SKU】${d.sku}`);
      if (d.moq) parts.push(`【MOQ】${d.moq}`);
      if (d.h1 && Array.isArray(d.h1) && d.h1.length)
        parts.push(`【H1】${d.h1.join(" | ")}`);
      if (d.preview) {
        parts.push("");
        parts.push("【简介 / Preview】");
        parts.push(d.preview);
      }

      // —— 站点优先规则（极简示例，可继续扩展）——
      try {
        const u = new URL(d.url || scrapeUrl);
        const host = u.hostname.toLowerCase();

        // 1688：常见中文页面，尝试从 preview 里抽「¥123」「￥」「元」
        if (host.includes("1688.com") || host.includes("alibaba.com.cn")) {
          if (!d.currency && /[\u00A5￥元]/.test(d.preview || "")) {
            parts.push("【规则】识别到人民币符号，已假定币种 CNY。");
          }
        }
        // Amazon：把“Amazon”作为 fallback 卖家
        if (host.includes("amazon.")) {
          if (!d.vendor) parts.push("【规则】供应商默认：Amazon");
        }
        // OTTO / Hornbach：德语站，若未识别币种，默认 EUR
        if (host.includes("otto.de") || host.includes("hornbach.de")) {
          if (!d.currency) parts.push("【规则】默认币种：EUR");
        }
      } catch (_) {}

      const body = parts.join("\n");
      setText(body || "（无可回填内容）");
      if (d.title) setTitle(String(d.title));
    } catch {
      alert("当前抓取结果不是合法 JSON。");
    }
  };

  /** 底部 /v1/api/scrape demo */
  const runDemo = async () => {
    if (!demoUrl.trim()) return;
    setDemoOut("抓取中…");
    try {
      const r = await fetch(
        `${API_BASE}/scrape?url=${encodeURIComponent(demoUrl)}`
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setDemoOut(JSON.stringify(j, null, 2));
    } catch (e) {
      console.error(e);
      setDemoOut("抓取失败: " + e.message);
    }
  };

  return (
    <div style={box}>
      <h2>MVP3：Scrapen + Ausfüllen + PDF erzeugen</h2>

      {/* 顶部：标题 / 正文 */}
      <div style={row}>
        <div>标题 / Titel：</div>
        <input
          style={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：测试报价单 / Testangebot"
        />
      </div>

      <div style={row}>
        <div>正文 / Text：</div>
        <textarea
          style={textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="在此输入 / 或使用下方『回填/智能回填』自动生成"
        />
      </div>

      <div style={row}>
        <button style={btn} onClick={checkHealth}>
          后端健康检查 / Backend-Check
        </button>
        <button style={btn} onClick={generatePdf}>
          生成 PDF / PDF erzeugen
        </button>
        <span style={{ marginLeft: 8 }}>{status}</span>
      </div>

      <div style={{ ...row, ...hint }}>
        API 基址 / API-Basis：{API_BASE}
      </div>

      <hr />

      {/* 中部：抓取 + 回填 */}
      <h3>🔍 Web-Scraping & 一键回填</h3>
      <div style={row}>
        <input
          style={{ ...input, width: "70%" }}
          value={scrapeUrl}
          onChange={(e) => setScrapeUrl(e.target.value)}
        />
        <button style={btn} onClick={doScrape}>
          抓取 / Scrapen
        </button>
        <button style={btn} onClick={fillBasic}>
          回填（基础）
        </button>
        <button style={btn} onClick={fillSmart}>
          智能回填（含价格/币种/SKU/MOQ）
        </button>
      </div>

      <textarea
        style={{ ...textarea, height: 220 }}
        value={scrapeJson}
        onChange={(e) => setScrapeJson(e.target.value)}
        placeholder="抓取结果将显示在这里（JSON）"
      />

      <hr />

      {/* 底部：/v1/api/scrape Demo */}
      <h3>网页抓取 Demo (/v1/api/scrape)</h3>
      <div style={row}>
        <input
          style={{ ...input, width: "70%" }}
          value={demoUrl}
          onChange={(e) => setDemoUrl(e.target.value)}
        />
        <button style={btn} onClick={runDemo}>
          抓取
        </button>
      </div>
      <textarea
        style={{ ...textarea, height: 120 }}
        value={demoOut}
        onChange={(e) => setDemoOut(e.target.value)}
      />
    </div>
  );
}
