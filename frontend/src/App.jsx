// frontend/src/App.jsx
import React, { useState } from "react";

const API =
  (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "") ||
  "https://yunivera-mvp2.onrender.com/v1/api";

/* ----------------------- 工具函数：解析 & 文本拼装 ----------------------- */

// 将 HTML 变纯文本
function stripTags(html = "") {
  try {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  } catch {
    return html;
  }
}

// 统一小数点与千分位，返回数字字符串（不做 parseFloat，避免精度/格式丢失）
function normalizeNumber(txt) {
  if (!txt) return "";
  // 1.000,50 → 1000,50 → 1000.50
  const t = txt.trim();
  if (t.includes(".") && t.includes(",")) {
    // 认为 . 为千分，, 为小数
    return t.replace(/\./g, "").replace(",", ".");
  }
  // 1,000.50 → 1000.50
  return t.replace(/,/g, "");
}

function firstNonEmpty(...candidates) {
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) return c[0];
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

// 价格/币种抽取（从已抓的 title/description/h1/preview 文本里找）
function extractPriceCurrency(text) {
  const src = text || "";
  // 形如：€ 12,34  /  12,34 €  /  USD 12.34  /  12.34 USD  /  ¥88  /  RMB 88
  const re =
    /(?:(€|EUR|USD|US\$|\$|GBP|£|CNY|RMB|¥)\s*([\d.,]+))|(?:([\d.,]+)\s*(€|EUR|USD|US\$|\$|GBP|£|CNY|RMB|¥))/i;
  const m = src.match(re);
  if (!m) return { price: null, currency: null };
  let price = null;
  let currency = null;
  if (m[1] && m[2]) {
    currency = m[1].toUpperCase();
    price = normalizeNumber(m[2]);
  } else if (m[3] && m[4]) {
    currency = m[4].toUpperCase();
    price = normalizeNumber(m[3]);
  }
  // 归一化币种显示
  const map = { "US$": "USD", $: "USD", "€": "EUR", "£": "GBP", "¥": "CNY", RMB: "CNY" };
  currency = map[currency] || currency;
  return { price, currency };
}

// SKU 抽取
function extractSKU(text) {
  const re =
    /(SKU|Artikel(?:\-?Nr\.?)?|Artikelnummer|型[号號]|货号|款号|型号)\s*[:#]?\s*([A-Za-z0-9\-\._\/]+)/i;
  const m = (text || "").match(re);
  if (!m) return null;
  return m[2];
}

// MOQ 抽取
function extractMOQ(text) {
  const re =
    /(MOQ|最小起订|起订量|起订|Mindestbestellmenge|Mind\.?\s?Bestellmenge|Min\.?\s?Order)\s*[:#]?\s*(\d+)/i;
  const m = (text || "").match(re);
  if (!m) return null;
  return m[2];
}

// 将抓取 JSON 中的若干字段拼为「可被抽取」的大文本
function glueScrapeText(scrape) {
  const parts = [];
  if (scrape?.title) parts.push(scrape.title);
  if (Array.isArray(scrape?.h1)) parts.push(scrape.h1.join(" | "));
  if (scrape?.description) parts.push(scrape.description);
  if (scrape?.preview) parts.push(stripTags(scrape.preview));
  return parts.filter(Boolean).join("\n");
}

// 生成报价正文（中/德/英三语混排），你也可以改成只输出某一种语言
function buildQuoteText({ name, sku, price, currency, moq, url }) {
  const cn = [
    "【基本信息】",
    `名称：${name || "(未识别)"}`,
    `SKU：${sku || "(未识别)"}`,
    `价格：${price ? price + " " + (currency || "") : "(未识别)"}`,
    `MOQ：${moq || "(未识别)"}`,
    url ? `来源：${url}` : null,
    "",
    "【备注】",
    "1）上方为自动识别结果，仅供初审，请以卖家/供应商实际报价为准；",
    "2）如需我们匹配等效/替代款，或批量比价，请直接回复链接。",
  ]
    .filter(Boolean)
    .join("\n");

  const de = [
    "【DE | Basisinfo】",
    `Name: ${name || "(nicht erkannt)"}`,
    `SKU: ${sku || "(nicht erkannt)"}`,
    `Preis: ${price ? price + " " + (currency || "") : "(nicht erkannt)"}`,
    `MOQ: ${moq || "(nicht erkannt)"}`,
    url ? `Quelle: ${url}` : null,
    "",
    "Hinweis:",
    "1) Obige Werte sind automatisch extrahiert. Bitte Angebot des Anbieters prüfen.",
    "2) Für Alternativen / Preisvergleiche antworten Sie gern mit dem Link.",
  ]
    .filter(Boolean)
    .join("\n");

  const en = [
    "【EN | Summary】",
    `Name: ${name || "(n/a)"}`,
    `SKU: ${sku || "(n/a)"}`,
    `Price: ${price ? price + " " + (currency || "") : "(n/a)"}`,
    `MOQ: ${moq || "(n/a)"}`,
    url ? `Source: ${url}` : null,
    "",
    "Notes:",
    "1) Auto-extracted for quick screening; please confirm with the seller.",
    "2) Reply with the link if you want alternatives or bulk comparison.",
  ]
    .filter(Boolean)
    .join("\n");

  return `${cn}\n\n${de}\n\n${en}`;
}

/* ----------------------- 页面组件 ----------------------- */

export default function App() {
  // 顶部：标题 & 正文
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  // 健康检查
  const [healthMsg, setHealthMsg] = useState("Bereit. / 就绪。");
  const [pinging, setPinging] = useState(false);

  // 生成 PDF
  const [pdfLoading, setPdfLoading] = useState(false);

  // 简易抓取 + 结果
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

  // 旧版回填：仅把 title/h1/字数拼到正文
  function fillFromScrapeSimple() {
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

  // 新增：智能回填（抽取 price / currency / sku / moq）
  function fillFromScrapeSmart() {
    try {
      const data = JSON.parse(scrapeJson);
      const name = firstNonEmpty(data?.title, data?.h1);
      const rawText = glueScrapeText(data);
      const { price, currency } = extractPriceCurrency(rawText);
      const sku = extractSKU(rawText);
      const moq = extractMOQ(rawText);

      // 标题：优先取抓到的 title/h1
      if (name) setTitle(name);

      // 拼装正文（三语）
      const body = buildQuoteText({
        name,
        sku,
        price,
        currency,
        moq,
        url: data?.url,
      });

      setText(body);
      alert("已智能回填（含价格/币种/SKU/MOQ）。请检查后直接生成 PDF。");
    } catch (e) {
      console.error(e);
      alert("当前抓取数据不是 JSON，或无法解析。请先确保抓取成功再试。");
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
              rows={10}
              style={{ width: "100%", padding: 6, marginTop: 4 }}
              placeholder="在此输入或使用下方『回填/智能回填』自动生成"
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
      <h3>🔎 Web-Scraping & 一键回填</h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <input
          value={scrapeUrl}
          onChange={(e) => setScrapeUrl(e.target.value)}
          style={{ flex: 1, minWidth: 300, padding: 6 }}
          placeholder="https://example.com 或商品详情页 URL"
        />
        <button onClick={doScrape}>抓取 / Scrapen</button>
        <button onClick={fillFromScrapeSimple} title="仅回填标题/H1/字数等基础信息">
          回填（基础）
        </button>
        <button onClick={fillFromScrapeSmart} title="解析并回填价格/币种/SKU/MOQ 等关键信息">
          智能回填（含价格/币种/SKU/MOQ）
        </button>
      </div>

      <textarea
        rows={12}
        readOnly
        value={scrapeJson}
        style={{ width: "100%", padding: 8, fontFamily: "ui-monospace, monospace" }}
        placeholder="抓取结果将显示在这里（JSON）"
      />
    </div>
  );
}
