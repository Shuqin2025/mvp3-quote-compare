import React, { useMemo, useRef, useState } from "react";

/**
 * MVP3 前端（增强版）
 * - 后端基址优先读取：VITE_API_BASE，其次 VITE_API_URL（Render 环境变量）
 * - 提供：/v1/api/health、/v1/api/pdf、/v1/api/scrape、/v1/api/catalog/parse
 * - 导出：/v1/api/export/excel（HTML->XLS 兼容），/v1/api/export/table-pdf（pdfkit）
 * - 新增：VITE_SHOW_SCRAPE=0 隐藏 “Web-Scraping & 一键回填” 模块
 */

const fallbackAPI = "https://yunivera-mvp2-cwyr.onrender.com";

function App() {
  const API_BASE = useMemo(() => {
    const envBase = import.meta?.env?.VITE_API_BASE?.trim?.();
    const envUrl  = import.meta?.env?.VITE_API_URL?.trim?.();
    const qp = (() => {
      try {
        const u = new URL(window.location.href);
        return u.searchParams.get("api")?.trim();
      } catch { return ""; }
    })();
    return qp || envBase || envUrl || fallbackAPI;
  }, []);

  // 是否展示 “Web-Scraping & 一键回填” 模块（默认显示；env=0 隐藏）
  const SHOW_SCRAPE = (import.meta?.env?.VITE_SHOW_SCRAPE ?? "1") !== "0";

  // 标题 & 正文
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  // 健康检查
  const [health, setHealth] = useState("");

  // 抓取区（可被隐藏）
  const [url, setUrl] = useState("https://example.com");
  const [scrapeJson, setScrapeJson] = useState("");

  // 目录抓取
  const [catalogUrl, setCatalogUrl] = useState("https://example.com");
  const [catalogJson, setCatalogJson] = useState("");

  const busyRef = useRef(false);
  const catalogBoxRef = useRef(null);

  const alertMsg = (msg) => {
    try { window.alert(msg); } catch { console.log(msg); }
  };

  const fetchJson = async (path, payload) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HTTP ${res.status} - ${err || "request failed"}`);
    }
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
  };

  // 健康检查
  const doHealthCheck = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/api/health`, { method: "GET" });
      const txt = await res.text();
      setHealth(`PING ${res.status} OK | ${txt}`);
      alertMsg(`后端健康检查成功：${res.status}`);
    } catch (e) {
      setHealth(`健康检查失败：${e.message}`);
      alertMsg(`后端健康检查失败：${e.message}`);
    }
  };

  // 整页 PDF
  const doGeneratePdf = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const payload = {
        title: title?.trim() || "未命名文档",
        text: text?.trim() || "",
        logo: "",
        source: "",
      };
      const res = await fetch(`${API_BASE}/v1/api/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/pdf" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} | ${await res.text()}`);
      const blob = await res.blob();
      triggerDownload(blob, "quote.pdf");
      alertMsg("PDF 已生成并开始下载。");
    } catch (e) {
      alertMsg(`PDF 生成失败：${e.message}`);
      console.error(e);
    } finally {
      busyRef.current = false;
    }
  };

  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // —— 小工具：判断是否像“目录链接” —— //
  const looksLikeCatalog = (u = "") => {
    const s = (u || "").toLowerCase();
    return /\/catalog\//.test(s) || /\/katalog\//.test(s);
  };

  // 单页抓取（当模块隐藏时用户看不到这块；逻辑仍保留以便日后开启）
  const doScrape = async () => {
    const u = url?.trim();
    if (!u) return alertMsg("请先输入要抓取的网页链接。");

    // 自动分流：如果像目录链接，移动到下方输入框
    if (looksLikeCatalog(u)) {
      setCatalogUrl(u);
      alertMsg("检测到这是一个【目录链接】，已自动转移到下方【目录抓取 Demo】输入框，请在下方点击：抓取目录。");
      setTimeout(() => catalogBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return;
    }

    // 正常单页抓取
    try {
      const data = await fetchJson("/v1/api/scrape", { url: u });
      setScrapeJson(JSON.stringify(data, null, 2));
    } catch (e) {
      setScrapeJson(`抓取失败：${e.message}`);
      alertMsg(`抓取失败：${e.message}`);
    }
  };

  // 回填（基础）
  const doFillBasic = () => {
    if (!scrapeJson) return alertMsg("请先抓取，再回填。");
    try {
      const obj = JSON.parse(scrapeJson);
      const t = obj?.title || obj?.name || "";
      const preview =
        obj?.preview || obj?.description || (obj?.ok ? `【抓取成功】${obj?.url || ""}` : "");
      if (t) setTitle(t);
      const addition = [
        "【基本信息】",
        `名称: ${t || "（未识别）"}`,
        `URL: ${obj?.url || "（未知）"}`,
        obj?.preview ? `简介: ${obj.preview}` : "",
        "",
      ].filter(Boolean).join("\n");
      setText((old) => (old ? `${old}\n\n${addition}` : addition));
      alertMsg("已回填基础信息。");
    } catch (e) {
      alertMsg(`回填失败：${e.message}`);
    }
  };

  // “智能回填”占位（暂时与基础回填一致）
  const doFillSmart = async () => {
    if (!scrapeJson) return alertMsg("请先抓取，再回填。");
    try { doFillBasic(); } catch (e) { alertMsg(`智能回填失败：${e.message}`); }
  };

  // 目录抓取
  const doCatalogParse = async () => {
    const u = catalogUrl?.trim();
    if (!u) return alertMsg("请先输入目录页链接。");
    try {
      const data = await fetchJson("/v1/api/catalog/parse", { url: u });
      setCatalogJson(JSON.stringify(data, null, 2));
    } catch (e) {
      setCatalogJson(`目录抓取失败：${e.message}`);
      alertMsg(`目录抓取失败：${e.message}`);
    }
  };

  // 目录 -> 正文（前 N 条）
  const writeCatalogToText = (limit = 50) => {
    if (!catalogJson) return alertMsg("请先抓取目录。");
    try {
      const obj = JSON.parse(catalogJson);
      const list = obj?.products || obj?.items || [];
      if (!Array.isArray(list) || list.length === 0) {
        return alertMsg("目录结果中找不到 products/items 列表。");
      }
      const take = list.slice(0, limit);
      const rows = take.map((p, i) => {
        const name = p?.title || p?.name || p?.sku || `Item ${i + 1}`;
        const sku = p?.sku ? ` | SKU: ${p.sku}` : "";
        const price = p?.price ? ` | 价格: ${p.price}` : "";
        const moq = p?.moq ? ` | MOQ: ${p.moq}` : "";
        return `- ${name}${sku}${price}${moq}`;
      });
      const block = ["【抓取目录（前 50 条）】", ...rows, ""].join("\n");
      setText((old) => (old ? `${old}\n\n${block}` : block));
      alertMsg("已将目录前 50 条写入正文。");
    } catch (e) {
      alertMsg(`写入正文失败：${e.message}`);
    }
  };

  // 统一整理成导出表格的列 & 行
  const normalizeCatalogTable = () => {
    if (!catalogJson) throw new Error("请先抓取目录再导出。");
    const obj = JSON.parse(catalogJson);
    const list = obj?.products || obj?.items || [];
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error("目录结果中找不到 products/items 列表。");
    }
    const columns = [
      { key: "index",  title: "#",             width: 6  },
      { key: "title",  title: "标题/Title",    width: 32 },
      { key: "sku",    title: "SKU",           width: 16 },
      { key: "price",  title: "价格/Price",    width: 14 },
      { key: "moq",    title: "MOQ",           width: 10 },
      { key: "url",    title: "链接/URL",      width: 48 },
      { key: "image",  title: "图片/Image",    width: 30 },
    ];
    const rows = list.map((p, i) => ({
      index: i + 1,
      title: p?.title || p?.name || "",
      sku:   p?.sku   || "",
      price: p?.price ?? "",
      moq:   p?.moq   ?? "",
      url:   p?.url || p?.link || "",
      image: p?.image || p?.img || (Array.isArray(p?.images) ? p.images[0] : ""),
    }));
    return { columns, rows };
  };

  // 导出 Excel
  const exportExcel = async () => {
    try {
      const { columns, rows } = normalizeCatalogTable();
      const payload = {
        name: title?.trim() || "导出结果",
        columns, rows,
        meta: { source: catalogUrl, generatedBy: "MVP3-Frontend" },
      };
      const res = await fetch(`${API_BASE}/v1/api/export/excel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/vnd.ms-excel",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} | ${await res.text()}`);
      const blob = await res.blob();
      triggerDownload(blob, `${payload.name || "export"}.xls`);
      alertMsg("Excel 已生成并开始下载。");
    } catch (e) {
      alertMsg(`导出 Excel 失败：${e.message}`);
      console.error(e);
    }
  };

  // 导出 表格PDF
  const exportTablePdf = async () => {
    try {
      const { columns, rows } = normalizeCatalogTable();
      const payload = {
        title: title?.trim() || "表格导出",
        subtitle: catalogUrl || "",
        columns, rows,
      };
      const res = await fetch(`${API_BASE}/v1/api/export/table-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/pdf" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} | ${await res.text()}`);
      const blob = await res.blob();
      triggerDownload(blob, `${payload.title || "table"}.pdf`);
      alertMsg("表格 PDF 已生成并开始下载。");
    } catch (e) {
      alertMsg(`导出表格 PDF 失败：${e.message}`);
      console.error(e);
    }
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px" }}>
      <h2 style={{ margin: "0 0 14px" }}>MVP3：Scrapen + Ausfüllen + PDF erzeugen</h2>

      {/* 标题 / 正文 */}
      <div style={{ marginBottom: 10 }}>
        <div>标题 / Titel：</div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：测试报价单 / Testangebot"
          style={{ width: "100%", height: 28, padding: "0 8px" }}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div>正文 / Text：</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="在此输入或使用下方‘回填/智能回填/目录抓取’自动生成"
          style={{ width: "100%", height: 220, padding: 8 }}
        />
      </div>

      {/* 后端健康检查 + 生成 PDF + PING 状态 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={doHealthCheck}>后端健康检查 / Backend-Check</button>
        <button onClick={doGeneratePdf}>生成 PDF / PDF erzeugen</button>
        <span style={{ color: health.startsWith("PING") ? "#0a7a0a" : "#888" }}>
          [PING] {health || "尚未检查"}
        </span>
      </div>

      <div style={{ marginTop: 6, color: "#666", fontSize: 12 }}>
        API 基址 / API-Basis： <code>{API_BASE}/v1/api</code>
      </div>

      {/* 🔎 Web-Scraping & 一键回填（按开关显示/隐藏） */}
      {SHOW_SCRAPE && (
        <div style={{ marginTop: 24 }}>
          <h3>🔎 Web-Scraping & 一键回填</h3>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ flex: 1, height: 28, padding: "0 8px" }}
              placeholder="https://example.com"
            />
            <button onClick={doScrape}>抓取 / Scrapen</button>
            <button onClick={doFillBasic}>回填（基础）</button>
            <button onClick={doFillSmart}>智能回填（含价格/币种/SKU/MOQ）</button>
          </div>
          <textarea
            value={scrapeJson}
            readOnly
            placeholder="抓取结果 JSON 会显示在这里"
            style={{ width: "100%", height: 220, padding: 8, marginTop: 8 }}
          />
        </div>
      )}

      {/* 目录抓取 + 导出 */}
      <div style={{ marginTop: 24 }} ref={catalogBoxRef}>
        <h3>📚 目录抓取 Demo（/v1/api/catalog/parse）</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input
            value={catalogUrl}
            onChange={(e) => setCatalogUrl(e.target.value)}
            style={{ flex: 1, minWidth: 300, height: 28, padding: "0 8px" }}
            placeholder="https://example.com"
          />
          <button onClick={doCatalogParse}>抓取目录</button>
          <button onClick={() => writeCatalogToText(50)}>目录写入正文（前 50 条）</button>
          <button onClick={exportExcel}>导出 Excel</button>
          <button onClick={exportTablePdf}>表格 PDF</button>
        </div>
        <textarea
          value={catalogJson}
          readOnly
          placeholder="目录抓取结果 JSON 会显示在这里"
          style={{ width: "100%", height: 220, padding: 8, marginTop: 8 }}
        />
      </div>
    </div>
  );
}

export default App;
