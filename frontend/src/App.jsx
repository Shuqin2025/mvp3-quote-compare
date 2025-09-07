import React, { useEffect, useMemo, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  ""; // 兼容你的两种变量名

const isCatalogUrl = (u) => /\/catalog\//i.test(u || "");

export default function App() {
  // —— 顶部健康检查与 PDF —— //
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ping, setPing] = useState("尚未检查");
  const [pingLoading, setPingLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // —— 单页抓取（回填） —— //
  const [scrapeUrl, setScrapeUrl] = useState("https://example.com");
  const [scrapeResult, setScrapeResult] = useState("");
  const [scrapeLoading, setScrapeLoading] = useState(false);

  // —— 目录抓取 —— //
  const [catalogUrl, setCatalogUrl] = useState("https://example.com");
  const [catalogJson, setCatalogJson] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [writeTopLoading, setWriteTopLoading] = useState(false);

  const api = useMemo(() => API_BASE.replace(/\/+$/, "") + "/v1/api", []);

  // 健康检查
  const doPing = async () => {
    if (!api) return alert("API 基址未配置");
    try {
      setPingLoading(true);
      const r = await fetch(`${api}/health`);
      const j = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(j));
      setPing(`PING 200 OK | ${JSON.stringify(j)}`);
    } catch (e) {
      setPing(`健康检查失败： ${String(e.message || e)}`);
      alert(`后端健康检查失败： ${String(e.message || e)}`);
    } finally {
      setPingLoading(false);
    }
  };

  useEffect(() => {
    // 自动试一次，方便验证
    doPing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 生成 PDF（沿用你原有 API）
  const generatePdf = async () => {
    if (!api) return alert("API 基址未配置");
    try {
      setPdfLoading(true);
      const r = await fetch(`${api}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // 后端会触发浏览器下载
      alert("PDF 已生成并开始下载。");
    } catch (e) {
      alert(`PDF 生成失败： ${String(e.message || e)}`);
    } finally {
      setPdfLoading(false);
    }
  };

  // —— 改动点 1 & 2：更清晰的占位文字 + 误粘贴目录链接时的友好提示 —— //
  const handleScrape = async () => {
    if (!api) return alert("API 基址未配置");
    const url = scrapeUrl.trim();

    // 如果用户把“目录链接”粘到了“单页抓取”里，友好拦截 + 一键转移
    if (isCatalogUrl(url)) {
      setCatalogUrl(url);
      alert(
        "检测到这是一个『目录链接』，已自动转移到下方【目录抓取 Demo】输入框，请在下方点击『抓取目录』。"
      );
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      return alert("请输入以 http(s) 开头的网页地址（单页详情）");
    }

    try {
      setScrapeLoading(true);
      setScrapeResult("⏳ 抓取中...");
      const r = await fetch(`${api}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`HTTP ${r.status} - ${JSON.stringify(j)}`);
      setScrapeResult(JSON.stringify(j, null, 2));
    } catch (e) {
      setScrapeResult(`❌ 抓取失败： ${String(e.message || e)}`);
      alert(`抓取失败： ${String(e.message || e)}`);
    } finally {
      setScrapeLoading(false);
    }
  };

  const handleCatalogParse = async () => {
    if (!api) return alert("API 基址未配置");
    const url = catalogUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      return alert("请输入以 http(s) 开头的目录地址");
    }
    try {
      setCatalogLoading(true);
      setCatalogJson(null);
      const r = await fetch(`${api}/catalog/parse?url=${encodeURIComponent(url)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(`HTTP ${r.status} - ${JSON.stringify(j)}`);
      setCatalogJson(j);
    } catch (e) {
      alert(`目录抓取失败： ${String(e.message || e)}`);
      setCatalogJson({ ok: false, error: String(e.message || e) });
    } finally {
      setCatalogLoading(false);
    }
  };

  // 写入正文（前50条）
  const writeCatalogToBody = async () => {
    if (!catalogJson?.ok || !Array.isArray(catalogJson.products)) {
      return alert("请先抓取目录，再写入正文。");
    }
    try {
      setWriteTopLoading(true);
      const top = catalogJson.products.slice(0, 50);
      const lines = ["【抓取目录（前 50 条）】", ...top.map((p, i) => `- ${p.title || ""}`)];
      setBody(lines.join("\n"));
    } finally {
      setWriteTopLoading(false);
    }
  };

  // 导出 Excel
  const exportExcel = async () => {
    if (!api) return alert("API 基址未配置");
    if (!catalogJson?.ok || !Array.isArray(catalogJson.products)) {
      return alert("请先抓取目录，再导出 Excel。");
    }
    try {
      setExportLoading(true);
      const r = await fetch(`${api}/export/excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: catalogJson.source,
          products: catalogJson.products,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      alert("Excel 已生成并开始下载。");
    } catch (e) {
      alert(`导出 Excel 失败： ${String(e.message || e)}`);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "1rem" }}>
      <h1>MVP3：Scrapen + Ausfüllen + PDF erzeugen</h1>

      {/* 标题 */}
      <div>
        <label>标题 / Titel：</label>
        <input
          style={{ width: "100%" }}
          placeholder="例如：测试报价单 / Testangebot"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* 正文 */}
      <div style={{ marginTop: 12 }}>
        <label>正文 / Text：</label>
        <textarea
          style={{ width: "100%", height: 220 }}
          placeholder="在此输入或使用下方『回填/智能回填/目录抓取』自动生成"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      {/* 后端检查 & PDF */}
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button onClick={doPing} disabled={pingLoading}>
          {pingLoading ? "检查中…" : "后端健康检查 / Backend-Check"}
        </button>
        <button onClick={generatePdf} disabled={pdfLoading}>
          {pdfLoading ? "生成中…" : "生成 PDF / PDF erzeugen"}
        </button>
        <span style={{ color: "#555" }}>[PING] {ping}</span>
        <div style={{ fontSize: 12, color: "#777" }}>
          API 基址 / API-Basis： <code>{api}</code>
        </div>
      </div>

      {/* —— Web-Scraping（一键回填） —— */}
      <h3 style={{ marginTop: 16 }}>🔎 Web-Scraping & 一键回填</h3>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ flex: 1 }}
          placeholder="https://example.com（单页详情）"
          value={scrapeUrl}
          onChange={(e) => setScrapeUrl(e.target.value)}
        />
        <button onClick={handleScrape} disabled={scrapeLoading}>
          {scrapeLoading ? "抓取中…" : "抓取 / Scrapen"}
        </button>
        <button
          onClick={() => {
            // 方便把单页内容写回正文（基础）
            try {
              const j = JSON.parse(scrapeResult || "{}");
              const titleLine = j.title ? `【标题】\n${j.title}\n` : "";
              const descLine = j.description ? `【描述】\n${j.description}\n` : "";
              const h1Line =
                Array.isArray(j.h1) && j.h1.length
                  ? `【H1】\n${j.h1.join(" | ")}\n`
                  : "";
              setBody([titleLine, descLine, h1Line, body].join("\n").trim());
            } catch {
              alert("当前抓取结果不是有效 JSON，无法写入正文。");
            }
          }}
        >
          回填（基础）
        </button>
        <button
          onClick={() =>
            alert("智能回填（含价格/币种/SKU/MOQ）留作后续增强，目前请使用目录抓取 + Excel。")
          }
        >
          智能回填（含价格/币种/SKU/MOQ）
        </button>
      </div>
      <textarea
        style={{ width: "100%", height: 140, marginTop: 8 }}
        readOnly
        value={scrapeResult}
        placeholder="抓取结果 JSON 会显示在这里"
      />

      {/* —— 目录抓取 —— */}
      <h3 style={{ marginTop: 20 }}>📦 目录抓取 Demo（/v1/api/catalog/parse）</h3>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ flex: 1 }}
          placeholder="https://…/catalog/…（目录列表页）"
          value={catalogUrl}
          onChange={(e) => setCatalogUrl(e.target.value)}
        />
        <button onClick={handleCatalogParse} disabled={catalogLoading}>
          {catalogLoading ? "抓取中…" : "抓取目录"}
        </button>
        <button onClick={writeCatalogToBody} disabled={writeTopLoading}>
          {writeTopLoading ? "写入中…" : "目录写入正文（前 50 条）"}
        </button>
        <button onClick={exportExcel} disabled={exportLoading}>
          {exportLoading ? "导出中…" : "导出 Excel"}
        </button>
        <button
          onClick={() =>
            alert("表格 PDF 导出留作后续增强。当前请先用导出 Excel。")
          }
        >
          表格 PDF
        </button>
      </div>
      <textarea
        style={{ width: "100%", height: 240, marginTop: 8 }}
        readOnly
        value={
          catalogJson ? JSON.stringify(catalogJson, null, 2) : "（抓取结果 JSON 会显示在这里）"
        }
      />
    </div>
  );
}
