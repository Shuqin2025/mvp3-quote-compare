import React, { useMemo, useRef, useState } from "react";

/**
 * MVP3 前端（精简版）
 * - 读取后端 API 基址：VITE_API_URL（Render 环境变量），无则回退 fallbackAPI
 * - /v1/api/health   健康检查
 * - /v1/api/pdf      生成整页 PDF（application/pdf）
 * - /v1/api/scrape   单页抓取
 * - /v1/api/catalog/parse  目录抓取
 * - /v1/api/export/excel   导出 Excel（application/vnd.openxmlformats-officedocument.spreadsheetml.sheet）
 * - /v1/api/export/table-pdf 导出表格 PDF（application/pdf）
 */

// 兜底；真实地址通过 VITE_API_URL 指向你的新后端（yunivera-mvp2-cwyr.onrender.com）
const fallbackAPI = "https://yunivera-mvp2.onrender.com";

function App() {
  const API_BASE = useMemo(() => {
    const envUrl = import.meta?.env?.VITE_API_URL?.trim();
    return envUrl || fallbackAPI;
  }, []);

  // 顶部标题、正文
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  // 健康检查显示
  const [health, setHealth] = useState("");

  // 抓取区
  const [url, setUrl] = useState("https://example.com");
  const [scrapeJson, setScrapeJson] = useState("");

  // 目录抓取
  const [catalogUrl, setCatalogUrl] = useState("https://example.com");
  const [catalogJson, setCatalogJson] = useState("");

  const busyRef = useRef(false);

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
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} - ${errText || "request failed"}`);
    }
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
  };

  const doHealthCheck = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/api/health`);
      const txt = await res.text();
      setHealth(`PING ${res.status} OK | ${txt}`);
      alertMsg(`后端健康检查成功：${res.status}`);
    } catch (e) {
      setHealth(`健康检查失败：${e.message}`);
      alertMsg(`后端健康检查失败：${e.message}`);
    }
  };

  /** 生成整页 PDF（沿用后端 /v1/api/pdf） */
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
        headers: {
          "Content-Type": "application/json",
          Accept: "application/pdf",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`HTTP ${res.status} | ${msg}`);
      }
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

  /** 工具：触发浏览器下载 */
  const triggerDownload = (blob, filename) => {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  };

  /** 单页抓取 */
  const doScrape = async () => {
    if (!url?.trim()) return alertMsg("请先输入要抓取的网页链接。");
    try {
      const data = await fetchJson("/v1/api/scrape", { url: url.trim() });
      setScrapeJson(JSON.stringify(data, null, 2));
    } catch (e) {
      setScrapeJson(`抓取失败：${e.message}`);
      alertMsg(`抓取失败：${e.message}`);
    }
  };

  /** 回填（基础） */
  const doFillBasic = () => {
    if (!scrapeJson) return alertMsg("请先抓取，再回填。");
    try {
      const obj = JSON.parse(scrapeJson);
      const t = obj?.title || obj?.name || "";
      const preview =
        obj?.preview ||
        obj?.description ||
        (obj?.ok ? `【抓取成功】${obj?.url || ""}` : "");
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

  /** 智能回填（占位：当前用基础回填代替） */
  const doFillSmart = async () => {
    if (!scrapeJson) return alertMsg("请先抓取，再回填。");
    try { doFillBasic(); } catch (e) { alertMsg(`智能回填失败：${e.message}`); }
  };

  /** 目录抓取 */
  const doCatalogParse = async () => {
    if (!catalogUrl?.trim()) return alertMsg("请先输入目录页链接。");
    try {
      const data = await fetchJson("/v1/api/catalog/parse", { url: catalogUrl.trim() });
      setCatalogJson(JSON.stringify(data, null, 2));
    } catch (e) {
      setCatalogJson(`目录抓取失败：${e.message}`);
      alertMsg(`目录抓取失败：${e.message}`);
    }
  };

  /** 把目录 JSON 的前 N 条写入正文 */
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
        const name = p?.title || p?.name || `Item ${i + 1}`;
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

  /** 规范化目录数据（统一 columns & rows） */
  const normalizeCatalogTable = () => {
    if (!catalogJson) throw new Error("请先抓取目录再导出。");
    const obj = JSON.parse(catalogJson);
    const list = obj?.products || obj?.items || [];
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error("目录结果中找不到 products/items 列表。");
    }
    const columns = [
      { key: "index", title: "#", width: 6 },
      { key: "title", title: "标题/Title", width: 32 },
      { key: "sku", title: "SKU", width: 16 },
      { key: "price", title: "价格/Price", width: 14 },
      { key: "moq", title: "MOQ", width: 10 },
      { key: "url", title: "链接/URL", width: 48 },
      { key: "image", title: "图片/Image", width: 30 },
    ];
    const rows = list.map((p, i) => ({
      index: i + 1,
      title: p?.title || p?.name || "",
      sku: p?.sku || "",
      price: p?.price ?? "",
      moq: p?.moq ?? "",
      url: p?.url || p?.link || "",
      image: p?.image || p?.img || (Array.isArray(p?.images) ? p.images[0] : ""),
    }));
    return { columns, rows };
  };

  /** —— 导出 Excel —— */
  const exportExcel = async () => {
    try {
      const { columns, rows } = normalizeCatalogTable();
      const payload = {
        name: title?.trim() || "导出结果",
        columns,
        rows,
        meta: { source: catalogUrl, generatedBy: "MVP3-Frontend" },
      };
      const res = await fetch(`${API_BASE}/v1/api/export/excel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`HTTP ${res.status} | ${msg}`);
      }
      const blob = await res.blob();
      triggerDownload(blob, `${payload.name || "export"}.xlsx`);
      alertMsg("Excel 已生成并开始下载。");
    } catch (e) {
      alertMsg(`导出 Excel 失败：${e.message}`);
      console.error(e);
    }
  };

  /** —— 导出表格 PDF —— */
  const exportTablePdf = async () => {
    try {
      const { columns, rows } = normalizeCatalogTable();
      const payload = {
        title: title?.trim() || "表格导出",
        subtitle: catalogUrl || "",
        columns,
        rows,
      };
      const res = await fetch(`${API_BASE}/v1/api/export/table-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/pdf" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`HTTP ${res.status} | ${msg}`);
      }
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
        <span style={{ color: "#888" }}>[PING] {health || "尚未检查"}</span>
      </div>

      <div style={{ marginTop: 6, color: "#666", fontSize: 12 }}>
        API 基址 / API-Basis： <code>{API_BASE}/v1/api</code>
      </div>

      {/* Web-Scraping & 一键回填（保留） */}
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

      {/* 目录抓取 + 导出 */}
      <div style={{ marginTop: 24 }}>
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
