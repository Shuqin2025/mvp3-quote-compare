import React, { useEffect, useRef, useState } from "react";

const SCRAPE_API = import.meta.env.VITE_SCRAPE_API; // 👉 yunivera-mvp2/v1/api
const PDF_API    = import.meta.env.VITE_PDF_API;    // 👉 mvp3-quote-compare-backend

export default function App() {
  const titleRef = useRef(null);
  const contentRef = useRef(null);
  const scrapeInputRef = useRef(null);

  const [pingMsg, setPingMsg] = useState("后端健康检查中...");
  const [scrapeLog, setScrapeLog] = useState("");

  // 启动时分别 PING 两个后端
  useEffect(() => {
    (async () => {
      try {
        // 1) PING 抓取后端
        const r1 = await fetch(`${SCRAPE_API}/health`, { method: "GET", mode: "cors" });
        const t1 = await r1.json().catch(() => ({}));
        // 2) PING PDF 后端
        const r2 = await fetch(`${PDF_API}/health`, { method: "GET", mode: "cors" });
        const t2 = await r2.json().catch(() => ({}));

        setPingMsg(
          `[PING] 抓取=${r1.status} ${t1.ok ? "OK" : ""} | PDF=${r2.status} ${t2.ok ? "OK" : ""}`
        );
      } catch (err) {
        setPingMsg(`[PING] 失败：${err.message}`);
        alert(`[PING] 失败：${err.message}`);
      }
    })();
  }, []);

  // 生成 PDF（走 PDF_API）
  async function handleMakePdf() {
    try {
      const title = titleRef.current.value.trim();
      const content = contentRef.current.value.trim();
      if (!title) return alert("请填写标题");
      if (!content) return alert("请填写正文");

      const res = await fetch(`${PDF_API}/pdf`, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // PDF 后端通常返回 { ok: true, url: "..." } 或 Blob；这里演示两种兼容：
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await res.json();
        if (data.url) window.open(data.url, "_blank");
        else alert(`已生成：${JSON.stringify(data)}`);
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "quote.pdf";
        a.click();
        URL.revokeObjectURL(url);
        alert("PDF 已生成并下载。");
      }
    } catch (err) {
      alert(`生成失败： ${err.message}`);
    }
  }

  // 基础抓取 Demo（展示在下方日志）
  async function handleScrapeSimple() {
    const raw = scrapeInputRef.current.value.trim();
    if (!raw) return;
    setScrapeLog("⏳ 抓取中...");
    try {
      const r = await fetch(`${SCRAPE_API}/scrape?url=${encodeURIComponent(raw)}`, {
        method: "GET",
        mode: "cors",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setScrapeLog(JSON.stringify(data, null, 2));
    } catch (err) {
      setScrapeLog(`❌ 抓取失败：${err.message}`);
    }
  }

  // 一键回填（读取抓取结果的 title/desc/h1 回填到标题 + 正文）
  async function handleScrapeAndFill() {
    const raw = scrapeInputRef.current.value.trim();
    if (!raw) return;
    try {
      const r = await fetch(`${SCRAPE_API}/scrape?url=${encodeURIComponent(raw)}`, {
        method: "GET",
        mode: "cors",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();

      const title = (data.title || "").trim();
      const desc  = (data.description || "").trim();
      const h1s   = Array.isArray(data.h1) ? data.h1.join(" | ") : "";

      // 回填
      titleRef.current.value   = title || titleRef.current.value;
      contentRef.current.value =
        [desc && `摘要：${desc}`, h1s && `H1：${h1s}`]
          .filter(Boolean)
          .join("\n");

      alert("一键回填完成！");
    } catch (err) {
      alert(`一键回填失败： ${err.message}`);
    }
  }

  return (
    <div style={{ padding: "12px", fontFamily: "sans-serif" }}>
      <h2>MVP3：前端调用 /v1/api/pdf + 抓取回填 Demo</h2>

      <div style={{ margin: "8px 0", color: "#666" }}>
        API_BASE = <code>{SCRAPE_API}</code>（抓取） | <code>{PDF_API}</code>（PDF）
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>标题：</label>
        <input ref={titleRef} defaultValue="测试报价单" style={{ width: 300 }} />
      </div>

      <div>
        <label>正文：</label>
        <br />
        <textarea
          ref={contentRef}
          rows={7}
          cols={60}
          defaultValue="这是由前端调用后端 /v1/api/pdf 生成的 PDF，支持中文。"
        />
      </div>

      <div style={{ margin: "8px 0" }}>
        <button onClick={handleMakePdf}>生成 PDF</button>
        <span style={{ marginLeft: 12, color: "#888" }}>{pingMsg}</span>
      </div>

      <hr />

      <h3>🔍 网页抓取 & 一键回填</h3>
      <div style={{ marginBottom: 8 }}>
        <input
          ref={scrapeInputRef}
          defaultValue="https://example.com"
          style={{ width: 300 }}
        />
        <button onClick={handleScrapeAndFill} style={{ marginLeft: 6 }}>
          回填
        </button>
      </div>

      <h3>🧪 网页抓取 Demo (/v1/api/scrape)</h3>
      <div style={{ marginBottom: 8 }}>
        <input defaultValue="https://example.com" id="demoUrl" style={{ width: 300 }} />
        <button
          onClick={() => {
            const u = document.getElementById("demoUrl").value.trim();
            if (!u) return;
            scrapeInputRef.current.value = u;
            handleScrapeSimple();
          }}
          style={{ marginLeft: 6 }}
        >
          抓取
        </button>
      </div>
      <pre
        style={{
          minHeight: 200,
          background: "#f8f8f8",
          padding: 8,
          border: "1px solid #ddd",
          overflowX: "auto",
        }}
      >
        {scrapeLog}
      </pre>
    </div>
  );
}
