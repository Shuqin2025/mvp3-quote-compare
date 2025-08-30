import React, { useState, useEffect } from "react";

// ==== i18n（中/德） ====
const I18N = {
  zh: {
    appTitle: "MVP3：抓取 + 回填 + 生成 PDF",
    healthCheck: "后端健康检查",
    generatePDF: "生成 PDF",
    urlPlaceholder: "输入要抓取的 URL，例如 https://example.com",
    scrape: "抓取",
    fillTitle: "回填标题",
    fillBody: "回填正文",
    fillBoth: "标题+正文",
    apiBase: "API 基址",
    statusReady: "就绪。",
    titleLabel: "标题：",
    bodyLabel: "正文：",
    scrapeAndFill: "网页抓取 & 一键回填",
    scrapeDemo: "网页抓取 Demo (/v1/api/scrape)",
  },
  de: {
    appTitle: "MVP3: Scrapen + Ausfüllen + PDF erzeugen",
    healthCheck: "Backend-Gesundheitsprüfung",
    generatePDF: "PDF erzeugen",
    urlPlaceholder: "URL eingeben, z. B. https://example.com",
    scrape: "Scrapen",
    fillTitle: "Titel ausfüllen",
    fillBody: "Text ausfüllen",
    fillBoth: "Titel + Text",
    apiBase: "API-Basis",
    statusReady: "Bereit.",
    titleLabel: "Titel:",
    bodyLabel: "Text:",
    scrapeAndFill: "Web-Scraping & Ein-Klick-Ausfüllen",
    scrapeDemo: "Web-Scraping Demo (/v1/api/scrape)",
  },
};

function detectLang() {
  const saved = localStorage.getItem("lang");
  if (saved) return saved;
  const nav = (navigator.language || "zh").toLowerCase();
  return nav.startsWith("de") ? "de" : "zh";
}

export default function App() {
  // 状态
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("Ready.");
  const [scrapeUrl, setScrapeUrl] = useState("https://example.com");
  const [scrapeResult, setScrapeResult] = useState(null);

  // 多语言状态
  const [lang, setLang] = useState(detectLang());
  const t = (k) => I18N[lang][k] || k;
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("lang", lang);
  }, [lang]);

  // API 地址
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/v1/api";
  const PDF_API = import.meta.env.VITE_PDF_API || API_BASE;

  // 健康检查
  async function checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();
      setStatus("✅ " + JSON.stringify(data));
    } catch (e) {
      setStatus("❌ Health failed: " + e.message);
    }
  }

  // 生成 PDF
  async function generatePDF() {
    setStatus("⏳ 生成 PDF...");
    try {
      const res = await fetch(`${PDF_API}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: body }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "quote.pdf";
      a.click();
      setStatus("✅ PDF 已生成");
    } catch (e) {
      setStatus("❌ PDF 失败: " + e.message);
    }
  }

  // 抓取
  async function doScrape() {
    setStatus("⏳ 抓取中...");
    try {
      const res = await fetch(`${API_BASE}/scrape?url=${encodeURIComponent(scrapeUrl)}`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      setScrapeResult(data);
      setStatus("✅ 抓取成功");
    } catch (e) {
      setStatus("❌ 抓取失败: " + e.message);
    }
  }

  // 回填
  function applyTitle() {
    if (scrapeResult?.title) setTitle(scrapeResult.title);
  }
  function applyContent() {
    if (scrapeResult?.description) setBody(scrapeResult.description);
  }
  function applyBoth() {
    applyTitle();
    applyContent();
  }

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      {/* 语言切换器 */}
      <div style={{ position: "fixed", top: 12, right: 12 }}>
        <button onClick={() => setLang("zh")} disabled={lang === "zh"}>
          中文
        </button>
        <button
          onClick={() => setLang("de")}
          disabled={lang === "de"}
          style={{ marginLeft: 6 }}
        >
          Deutsch
        </button>
      </div>

      <h2>{t("appTitle")}</h2>

      <div style={{ marginBottom: 12 }}>
        <label>{t("titleLabel")}</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>{t("bodyLabel")}</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          style={{ width: "100%" }}
        />
      </div>

      <button onClick={checkHealth}>{t("healthCheck")}</button>
      <button onClick={generatePDF} style={{ marginLeft: 8 }}>
        {t("generatePDF")}
      </button>
      <div style={{ marginTop: 10 }}>{status}</div>

      <hr style={{ margin: "20px 0" }} />

      <h3>{t("scrapeAndFill")}</h3>
      <input
        value={scrapeUrl}
        onChange={(e) => setScrapeUrl(e.target.value)}
        style={{ width: "60%" }}
        placeholder={t("urlPlaceholder")}
      />
      <button onClick={doScrape} style={{ marginLeft: 8 }}>
        {t("scrape")}
      </button>

      {scrapeResult && (
        <div style={{ marginTop: 12, background: "#f9f9f9", padding: 10 }}>
          <pre>{JSON.stringify(scrapeResult, null, 2)}</pre>
          <div style={{ marginTop: 8 }}>
            <button onClick={applyTitle}>{t("fillTitle")}</button>
            <button onClick={applyContent} style={{ marginLeft: 6 }}>
              {t("fillBody")}
            </button>
            <button onClick={applyBoth} style={{ marginLeft: 6 }}>
              {t("fillBoth")}
            </button>
          </div>
        </div>
      )}

      <hr style={{ margin: "20px 0" }} />
      <div>
        {t("apiBase")}: <code>{API_BASE}</code>
      </div>
    </div>
  );
}
