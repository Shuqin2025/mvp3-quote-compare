// frontend/src/App.jsx
import React, { useState } from "react";

/** 后端 API 基址（优先读 .env 的 VITE_API_BASE，末尾斜杠自动移除） */
const API =
  (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "") ||
  "https://yunivera-mvp2.onrender.com/v1/api";

/* ============================ 工具函数 ============================ */
function stripTags(html = "") {
  try {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  } catch {
    return html;
  }
}
function normalizeNumber(txt) {
  if (!txt) return "";
  const t = txt.trim();
  if (t.includes(".") && t.includes(",")) {
    return t.replace(/\./g, "").replace(",", ".");
  }
  return t.replace(/,/g, "");
}
function firstNonEmpty(...candidates) {
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) return c[0];
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}
function glueScrapeText(scrape) {
  const parts = [];
  if (scrape?.title) parts.push(scrape.title);
  if (Array.isArray(scrape?.h1)) parts.push(scrape.h1.join(" | "));
  if (scrape?.description) parts.push(scrape.description);
  if (scrape?.preview) parts.push(stripTags(scrape.preview));
  return parts.filter(Boolean).join("\n");
}

/** ✨把 textarea 文本转换为 PDF 接口需要的 rows（二维数组） */
function buildRowsFromText(text) {
  const paragraphs = (text || "")
    .split(/\n\s*\n/g)
    .map((p) => p.split(/\n/g).map((s) => s.trim()).filter(Boolean))
    .filter((arr) => arr.length);

  const rows = [];
  if (paragraphs.length === 0) {
    rows.push(["(空白)"]);
  } else {
    for (const para of paragraphs) {
      for (const line of para) rows.push([line]);
      rows.push([""]); // 段落间空行
    }
    while (rows.length && rows[rows.length - 1][0] === "") rows.pop();
    if (!rows.length) rows.push(["(空白)"]);
  }
  return rows;
}

/* -------- 通用启发式：价格/币种、SKU、MOQ -------- */
function extractPriceCurrency(text) {
  const src = text || "";
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
  const map = { "US$": "USD", $: "USD", "€": "EUR", "£": "GBP", "¥": "CNY", RMB: "CNY" };
  currency = map[currency] || currency;
  return { price, currency };
}
function extractSKU(text) {
  const re =
    /(ASIN|SKU|Artikel(?:\-?Nr\.?)?|Artikelnummer|型[号號]|货号|款号|型号|EAN)\s*[:#]?\s*([A-Za-z0-9\-\._\/]{4,})/i;
  const m = (text || "").match(re);
  if (!m) return null;
  return m[2];
}
function extractMOQ(text) {
  const re =
    /(MOQ|最小起订|起订量|起订|Mindestbestellmenge|Mind\.?\s?Bestellmenge|Min\.?\s?Order)\s*[:#]?\s*(\d+)/i;
  const m = (text || "").match(re);
  if (!m) return null;
  return m[2];
}
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

/* ============================ 站点优先规则 ============================ */
function hostOf(urlStr) {
  try {
    return new URL(urlStr).hostname.toLowerCase();
  } catch {
    return "";
  }
}
function extractBySite(host, plainText) {
  const t = plainText || "";
  const out = { price: null, currency: null, sku: null, moq: null };

  // 1) 1688
  if (/1688\.com$|\.1688\.com$/.test(host)) {
    const mPrice =
      t.match(/(¥|￥|RMB|CNY)\s*([\d.,]+)/i) || t.match(/([\d.,]+)\s*(¥|￥|RMB|CNY)/i);
    if (mPrice) {
      const isLeading = /^(¥|￥|RMB|CNY)/i.test(mPrice[0]);
      out.currency = "CNY";
      out.price = normalizeNumber(isLeading ? mPrice[2] : mPrice[1]);
    }
    const mMoq = t.match(/(起订量|起订|最小起订)\s*[:：]?\s*(\d+)/);
    if (mMoq) out.moq = mMoq[2];
    const mSku =
      t.match(/(货号|型号|款号|SKU)\s*[:：#]?\s*([A-Za-z0-9\-\._\/]{3,})/) ||
      t.match(/Artikel(?:\-?Nr\.?|nummer)\s*[:#]?\s*([A-Za-z0-9\-\._\/]{3,})/i);
    if (mSku) out.sku = mSku[2] || mSku[1];
  }
  // 2) Alibaba
  else if (/alibaba\.com$|\.alibaba\.com$/.test(host)) {
    const mPrice =
      t.match(/(US\$|\$|USD|€|EUR|£|GBP|¥|CNY|RMB)\s*([\d.,]+)/i) ||
      t.match(/([\d.,]+)\s*(US\$|\$|USD|€|EUR|£|GBP|¥|CNY|RMB)/i);
    if (mPrice) {
      let cur = (mPrice[1] || mPrice[3] || "").toUpperCase();
      const map = { "US$": "USD", $: "USD", "€": "EUR", "£": "GBP", "¥": "CNY", RMB: "CNY" };
      out.currency = map[cur] || cur;
      out.price = normalizeNumber(mPrice[2] || mPrice[1]);
    }
    const mMoq = t.match(/(MOQ|Min\.?\s?Order)\s*[:#]?\s*(\d+)/i);
    if (mMoq) out.moq = mMoq[2];
    const mSku = t.match(/(SKU|Model|Artikel(?:\-?Nr\.?)?)\s*[:#]?\s*([A-Za-z0-9\-\._\/]{3,})/i);
    if (mSku) out.sku = mSku[2];
  }
  // 3) Amazon
  else if (/amazon\./.test(host)) {
    const mPrice =
      t.match(/(€|EUR|\$|USD|£|GBP)\s*([\d.,]+)/i) ||
      t.match(/([\d.,]+)\s*(€|EUR|\$|USD|£|GBP)/i);
    if (mPrice) {
      let cur = (mPrice[1] || mPrice[3] || "").toUpperCase();
      const map = { $: "USD", "€": "EUR", "£": "GBP" };
      out.currency = map[cur] || cur;
      out.price = normalizeNumber(mPrice[2] || mPrice[1]);
    }
    const mAsin = t.match(/ASIN\s*[:：]\s*([A-Z0-9]{10})/i);
    if (mAsin) out.sku = mAsin[1];
  }
  // 4) OTTO
  else if (/otto\.de$|\.otto\.de$/.test(host)) {
    const mPrice = t.match(/([\d.,]+)\s*(€|EUR)/i) || t.match(/(€|EUR)\s*([\d.,]+)/i);
    if (mPrice) {
      out.currency = "EUR";
      out.price = normalizeNumber(mPrice[1] || mPrice[2]);
    }
    const mSku = t.match(/Artikelnummer\s*[:#]?\s*([A-Za-z0-9\-\._\/]{3,})/i);
    if (mSku) out.sku = mSku[1];
  }
  // 5) Hornbach
  else if (/hornbach\.de$|\.hornbach\.de$/.test(host)) {
    const mPrice = t.match(/([\d.,]+)\s*(€|EUR)/i) || t.match(/(€|EUR)\s*([\d.,]+)/i);
    if (mPrice) {
      out.currency = "EUR";
      out.price = normalizeNumber(mPrice[1] || mPrice[2]);
    }
    const mSku =
      t.match(/(Artikelnummer|Art\.?\-?Nr\.?)\s*[:#]?\s*([A-Za-z0-9\-\._\/]{3,})/i);
    if (mSku) out.sku = mSku[2];
  }

  return out;
}

/* ============================ 页面组件 ============================ */
export default function App() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [healthMsg, setHealthMsg] = useState("Bereit. / 就绪。");
  const [pinging, setPinging] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

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

  /** ✅ 生成 PDF：按后端要求提交 { title, rows }；兼容二进制/JSON 两种返回 */
  async function generatePDF() {
    if (!title.trim() && !text.trim()) {
      alert("请先填写标题或正文（Title / Text）");
      return;
    }
    try {
      setPdfLoading(true);

      const rows = buildRowsFromText(text || title || "(空白)");

      const r = await fetch(`${API}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "报价单 / Quote",
          rows,
        }),
      });

      // ① 直接返回 PDF（二进制）
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      if (r.ok && ct.includes("application/pdf")) {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "quote.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }

      // ② 返回 JSON（可能含 file 路径）
      const txt = await r.text(); // 先拿文本，便于调试
      let data = {};
      try {
        data = JSON.parse(txt);
      } catch {}
      if (r.ok && data?.ok && data?.file) {
        // /files/xxx.pdf 在后端根域名下
        const origin = API.replace(/\/v1\/api$/, "");
        const fileUrl = new URL(data.file, origin).toString();
        window.location.href = fileUrl; // 触发下载
        return;
      }

      // 其他情况：报错
      throw new Error(`HTTP ${r.status} ${txt || ""}`.trim());
    } catch (e) {
      alert(`PDF 失败：${e?.message || e}`);
      console.error(e);
    } finally {
      setPdfLoading(false);
    }
  }

  // 抓取：与后端一致使用 POST
  async function doScrape() {
    try {
      setScrapeJson("抓取中 / Scraping …");
      const r = await fetch(`${API}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scrapeUrl }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setScrapeJson(JSON.stringify(data, null, 2));
    } catch (e) {
      setScrapeJson(`❌ 抓取失败：${e?.message || e}`);
    }
  }

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

  // 智能回填（站点优先规则 + 通用启发式兜底）
  function fillFromScrapeSmart() {
    try {
      const data = JSON.parse(scrapeJson);
      const name = firstNonEmpty(data?.title, data?.h1);
      const rawText = glueScrapeText(data);
      const host = hostOf(data?.url || scrapeUrl);

      const site = extractBySite(host, rawText);
      const generic = extractPriceCurrency(rawText);
      const skuGen = extractSKU(rawText);
      const moqGen = extractMOQ(rawText);

      const price = site.price || generic.price;
      const currency = site.currency || generic.currency;
      const sku = site.sku || skuGen;
      const moq = site.moq || moqGen;

      if (name) setTitle(name);
      const body = buildQuoteText({ name, sku, price, currency, moq, url: data?.url });
      setText(body);
      alert(`已智能回填（站点：${host || "未知"}）。请检查后直接生成 PDF。`);
    } catch (e) {
      console.error(e);
      alert("当前抓取数据不是 JSON，或无法解析。请先确保抓取成功再试。");
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, Arial, sans-serif", maxWidth: 980, margin: "20px auto" }}>
      <h2>MVP3：Scrapen + Ausfüllen + PDF erzeugen</h2>

      {/* 顶部：标题 + 正文 + 健康检查 & 生成 PDF */}
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

      {/* 抓取 & 一键回填 */}
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
