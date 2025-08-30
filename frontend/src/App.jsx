import React, { useEffect, useState } from "react";

/* ---------------- i18n（zh / de / en） ---------------- */
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
  en: {
    appTitle: "MVP3: Scrape + Autofill + Generate PDF",
    healthCheck: "Backend Health Check",
    generatePDF: "Generate PDF",
    urlPlaceholder: "Enter a URL, e.g. https://example.com",
    scrape: "Scrape",
    fillTitle: "Fill Title",
    fillBody: "Fill Body",
    fillBoth: "Title + Body",
    apiBase: "API Base",
    statusReady: "Ready.",
    titleLabel: "Title:",
    bodyLabel: "Body:",
    scrapeAndFill: "Web Scraping & One-Click Autofill",
    scrapeDemo: "Web Scraping Demo (/v1/api/scrape)",
  },
};

function detectLang() {
  const saved = localStorage.getItem("lang");
  if (saved) return saved;
  const nav = (navigator.language || "zh").toLowerCase();
  if (nav.startsWith("de")) return "de";
  if (nav.startsWith("en")) return "en";
  return "zh";
}

/* ---------------- API 地址解析 ---------------- */
function resolveApis() {
  const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
  const API_BASE = (env.VITE_API_BASE || "").replace(/\/+$/, "");
  const SCRAPE_API =
    (env.VITE_SCRAPE_API && env.VITE_SCRAPE_API.replace(/\/+$/, "")) ||
    API_BASE ||
    "https://yunivera-mvp2.onrender.com/v1/api";
  const PDF_API =
    (env.VITE_PDF_API && env.VITE_PDF_API.replace(/\/+$/, "")) ||
    API_BASE ||
    "https://mvp3-quote-compare-backend.onrender.com/v1/api";
  return { SCRAPE_API, PDF_API, API_BASE: SCRAPE_API };
}

export default function App() {
  /* ---------------- 状态 ---------------- */
  const [lang, setLang] = useState(detectLang());
  const t = (k) => I18N[lang][k] || k;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState(I18N[lang].statusReady);
  const [scrapeUrl, setScrapeUrl] = useState("https://example.com");
  const [scrapeResult, setScrapeResult] = useState(null);

  const { SCRAPE_API, PDF_API, API_BASE } = resolveApis();

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("lang", lang);
    setStatus(I18N[lang].statusReady);
  }, [lang]);

  /* ---------------- 健康检查（抓取后端） ---------------- */
  async function checkHealth() {
    try {
      setStatus("⏳");
      const r = await fetch(`${SCRAPE_API}/health`, { method: "GET", mode: "cors" });
      const j = await r.json().catch(() => ({}));
      setStatus("✅ " + JSON.stringify(j));
    } catch (e) {
      setStatus("❌ " + (e.message || "Failed to fetch"));
    }
  }

  /* ---------------- 生成 PDF（PDF_API） ---------------- */
  async function generatePDF() {
    try {
      setStatus("⏳");
      const r = await fetch(`${PDF_API}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: body }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const ct = r.headers.get("content-type") || "";
      if (ct.includes("application/pdf")) {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "quote.pdf";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // 兼容返回 JSON 带 fileUrl 的后端
        const data = await r.json().catch(() => ({}));
        if (data.fileUrl) {
          const baseHost = PDF_API.replace(/\/v1\/api\/?$/, "");
          window.open(`${baseHost}${data.fileUrl}`, "_blank");
        }
      }
      setStatus("✅");
    } catch (e) {
      setStatus("❌ " + (e.message || "Failed to fetch"));
    }
  }

  /* ---------------- 抓取 + 回填（SCRAPE_API） ---------------- */
  async function doScrape() {
    try {
      setStatus("⏳");
      const r = await fetch(`${SCRAPE_API}/scrape?url=${encodeURIComponent(scrapeUrl)}`, {
        method: "GET",
        mode: "cors",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setScrapeResult(data);
      setStatus("✅");
    } catch (e) {
      setStatus("❌ " + (e.message || "Failed to fetch"));
    }
  }
  function applyTitle() {
    if (scrapeResult?.title) setTitle(scrapeResult.title);
  }
  function applyContent() {
    const lines = [];
    if (scrapeResult?.description) lines.push(scrapeResult.description);
    if (Array.isArray(scrapeResult?.h1) && scrapeResult.h1.length)
      lines.push("H1: " + scrapeResult.h1.join(" | "));
    if (scrapeResult?.url) lines.push("Source: " + scrapeResult.url);
    if (lines.length) setBody(lines.join("\n"));
  }
  function applyBoth() {
    applyTitle();
    applyContent();
  }

  /* ---------------- UI ---------------- */
  return (
    <div style={{ padding: 20, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      {/* 语言切换器 */}
      <div style={{ position: "fixed", top: 12, right: 12 }}>
        <button onClick={() => setLang("zh")} disabled={lang === "zh"}>中文</button>
        <button onClick={() => setLang("de")} disabled={lang === "de"} style={{ marginLeft: 6 }}>Deutsch</button>
        <button onClick={() => setLang("en")} disabled={lang === "en"} style={{ marginLeft: 6 }}>English</button>
      </div>

      <h2>{t("appTitle")}</h2>

      <div style={{ marginBottom: 12 }}>
        <label>{t("titleLabel")}</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%" }} />
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
      <button onClick={generatePDF} style={{ marginLeft: 8 }}>{t("generatePDF")}</button>
      <div style={{ marginTop: 10, minHeight: 22 }}>{status}</div>

      <hr style={{ margin: "20px 0" }} />

      <h3>{t("scrapeAndFill")}</h3>
      <input
        value={scrapeUrl}
        onChange={(e) => setScrapeUrl(e.target.value)}
        style={{ width: "60%" }}
        placeholder={t("urlPlaceholder")}
      />
      <button onClick={doScrape} style={{ marginLeft: 8 }}>{t("scrape")}</button>

      {scrapeResult && (
        <div style={{ marginTop: 12, background: "#f9f9f9", padding: 10 }}>
          <pre style={{ overflow: "auto" }}>{JSON.stringify(scrapeResult, null, 2)}</pre>
          <div style={{ marginTop: 8 }}>
            <button onClick={applyTitle}>{t("fillTitle")}</button>
            <button onClick={applyContent} style={{ marginLeft: 6 }}>{t("fillBody")}</button>
            <button onClick={applyBoth} style={{ marginLeft: 6 }}>{t("fillBoth")}</button>
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
