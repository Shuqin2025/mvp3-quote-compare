// frontend/src/App.jsx
import React, { useState } from "react";

const API =
  (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "") ||
  "https://yunivera-mvp2.onrender.com/v1/api";

export default function App() {
  // 顶部：标题 & 正文
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  // 健康检查
  const [healthMsg, setHealthMsg] = useState("Bereit. / 就绪。");
  const [pinging, setPinging] = useState(false);

  // 生成 PDF
  const [pdfLoading, setPdfLoading] = useState(false);

  // 简易抓取 Demo
  const [scrapeUrl, setScrapeUrl] = useState("https://example.com");
  const [scrapeJson, setScrapeJson] = useState("");

  async function pingBackend() {
    try {
      setPinging(true);
      setHealthMsg("健康检查中 …");
      const r = await fetch(`${API}/health`);
      const data = await r.json();
      setHealthMsg(`[PING] ${r.status} OK | ${data.message || "OK"}`);
    } catch (e) {
      setHealthMsg(`[PING] 失败：${e?.message || e}`);
      alert(`[PING] 失败：${e?.message || e}`);
    } finally {
      setPinging(false);
    }
  }

  async function generatePDF() {
    if (!title.trim() && !text.trim()) {
      alert("请先填写标题或正文（Title / Text）");
      return;
    }
    try {
      setPdfLoading(true);
      // 注意：后端需要 { title, content }（不是 text）
      const r = await fetch(`${API}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "报价单 / Quote",
          content: text || "(正文为空)",
        }),
      });
      if (!r.ok) {
        const msg = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status} ${msg || ""}`.trim());
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "quote.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`PDF 失败：${e?.message || e}`);
      console.error(e);
    } finally {
      setPdfLoading(false);
    }
  }

  async function doScrape() {
    try {
      setScrapeJson("抓取中 / Scraping …");
      const r = await fetch(`${API}/scrape?url=${encodeURIComponent(scrapeUrl)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setScrapeJson(JSON.stringify(data, null, 2));
    } catch (e) {
      setScrapeJson(`❌ 抓取失败：${e?.message || e}`);
    }
  }

  // 一键回填（把抓到的 title / h1 拼到输入框里）
  function fillFromScrape() {
    try {
      const data = JSON.parse(scrapeJson);
      if (data?.title) setTitle(data.title);
      const h1 = Array.isArray(data?.h1) ? data.h1.join(" | ") : "";
      const bodyExtra =
        `\n\n[抓取信息]\nURL: ${data?.url || ""}\nH1: ${h1 || "(无)"}\n字数估算: ${data?.approxTextLength ?? "-"}\n`;
      setText((t) => (t ? `${t}${bodyExtra}` : `[自动回填]\n${bodyExtra}`));
      alert("已回填标题/正文（可再手工修改后生成 PDF）");
    } catch {
      alert("当前抓取数据不是 JSON，无法回填。请先抓取成功再试。");
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, Arial, sans-serif", maxWidth: 980, margin: "20px auto" }}>
      <h2>MVP3：Scrapen + Ausfüllen + PDF erzeugen</h2>

      {/* 标题 & 正文 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 6 }}>
          <label>
            标题 / Titel：
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", padding: 6, marginTop: 4 }}
              placeholder="例如：测试报价单 / Testangebot"
            />
          </label>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>
            正文 / Text：
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              style={{ width: "100%", padding: 6, marginTop: 4 }}
              placeholder="在此输入正文内容（支持中/德/英多语言混排）"
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={pingBackend} disabled={pinging}>
            后端健康检查 / Backend-Check
          </button>
          <button onClick={generatePDF} disabled={pdfLoading}>
            {pdfLoading ? "PDF 生成中…" : "生成 PDF / PDF erzeugen"}
          </button>
          <span style={{ color: "#666" }}>{healthMsg}</span>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
          API 基址 / API-Basis： <code>{API}</code>
        </div>
      </div>

      <hr style={{ margin: "18px 0" }} />

      {/* 抓取区 */}
      <h3>🔎 Web-Scraping & Ein-Klick-Ausfüllen</h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <input
          value={scrapeUrl}
          onChange={(e) => setScrapeUrl(e.target.value)}
          style={{ flex: 1, padding: 6 }}
          placeholder="https://example.com 或商品详情页 URL"
        />
        <button onClick={doScrape}>Scrapen</button>
        <button onClick={fillFromScrape}>回填（标题+正文）</button>
      </div>

      <textarea
        rows={10}
        readOnly
        value={scrapeJson}
        style={{ width: "100%", padding: 8, fontFamily: "ui-monospace, monospace" }}
        placeholder="抓取结果将显示在这里（JSON）"
      />
    </div>
  );
}
