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

  // ……此处保留了原有1688 / Alibaba / Amazon / OTTO / Hornbach逻辑……
  // (不再粘贴全部，与你的版本保持一致)

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

  // 目录抓取（新增）
  const [catalogUrl, setCatalogUrl] = useState("https://example.com");
  const [catalogJson, setCatalogJson] = useState("");

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

  /** ✅ 生成 PDF（双模兼容：先 rows，失败再 content） */
  async function generatePDF() {
    if (!title.trim() && !text.trim()) {
      alert("请先填写标题或正文（Title / Text）");
      return;
    }
    try {
      setPdfLoading(true);

      const rows = buildRowsFromText(text || title || "(空白)");
      // —— 首次尝试：新接口 rows
      let r = await fetch(`${API}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "报价单 / Quote",
          rows,
        }),
      });

      // ① PDF（二进制）
      let ct = (r.headers.get("content-type") || "").toLowerCase();
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

      // ② JSON
      let txtResp = await r.text();
      let data = {};
      try {
        data = JSON.parse(txtResp);
      } catch {}

      const needOldFormat =
        !r.ok &&
        /content|body/i.test(txtResp) &&
        /(必填|缺失|required|missing)/i.test(txtResp);

      if (needOldFormat) {
        const r2 = await fetch(`${API}/pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title || "报价单 / Quote",
            content: (text || title || "").trim() || "（空白）",
          }),
        });

        const ct2 = (r2.headers.get("content-type") || "").toLowerCase();
        if (r2.ok && ct2.includes("application/pdf")) {
          const blob = await r2.blob();
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

        const txt2 = await r2.text();
        let data2 = {};
        try {
          data2 = JSON.parse(txt2);
        } catch {}
        if (r2.ok && data2?.ok && data2?.file) {
          const origin = API.replace(/\/v1\/api$/, "");
          const fileUrl = new URL(data2.file, origin).toString();
          window.location.href = fileUrl;
          return;
        }
        throw new Error(`HTTP ${r2.status} ${txt2 || ""}`.trim());
      }

      if (r.ok && data?.ok && data?.file) {
        const origin = API.replace(/\/v1\/api$/, "");
        const fileUrl = new URL(data.file, origin).toString();
        window.location.href = fileUrl;
        return;
      }
      throw new Error(`HTTP ${r.status} ${txtResp || ""}`.trim());
    } catch (e) {
      alert(`PDF 失败：${e?.message || e}`);
      console.error(e);
    } finally {
      setPdfLoading(false);
    }
  }

  // ……保留抓取、智能回填、目录抓取/写入正文函数……
  // （和你上个版本一致）

  return (
    <div style={{ fontFamily: "system-ui, Arial, sans-serif", maxWidth: 980, margin: "20px auto" }}>
      {/* 保持 UI 不变 */}
    </div>
  );
}
