import React, { useMemo, useRef, useState } from "react";

/**
 * MVP3 前端（精简版）
 * - 后端基址优先读取：VITE_API_BASE，其次 VITE_API_URL
 * - 提供：/v1/api/health、/v1/api/pdf、/v1/api/catalog/parse
 * - 导出：/v1/api/export/excel（HTML->XLS 兼容），/v1/api/export/table-pdf（pdfkit）
 * - 已移除：标题输入框、Web-Scraping & 一键回填
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

  // 文本正文（保留）
  const [text, setText] = useState("");

  // 健康检查提示
  const [health, setHealth] = useState("");

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

  // 生成整页 PDF（仍可从正文生成）
  const doGeneratePdf = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const payload = {
        title: bestDocTitle(),   // 自动推断标题
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

  // 目录抓取
  const doCatalogParse = async () => {
    const u = catalogUrl?.trim();
    if (!u) return alertMsg("请先输入目录页链接。");
    try {
      const data = await fetchJson("/v1/api/catalog/parse", { url: u });
      setCatalogJson(JSON.stringify(data, null, 2));
      // 滚动到结果区
      setTimeout(() => catalogBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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
        const name  = p?.title || p?.name || p?.sku || `Item ${i + 1}`;
        const sku   = p?.sku   ? ` | SKU: ${p.sku}`   : "";
        const price = p?.price ? ` | 价格: ${p.price}` : "";
        const moq   = p?.moq   ? ` | MOQ: ${p.moq}`   : "";
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

  // 从正文或目录 URL 推断一个友好的标题/文件名
  const bestDocTitle = () => {
    const firstLine = (text || "").split(/\r?\n/).map(s => s.trim()).find(Boolean);
    if (firstLine) return firstLine.slice(0, 40);
    try {
      const u = new URL(catalogUrl);
      const seg = (u.pathname.split("/").filter(Boolean).pop() || "").replace(/\.[a-z0-9]+$/i, "");
      return seg ? decodeURIComponent(seg).slice(0, 40) : "导出结果";
    } catch { return "导出结果"; }
  };

  // 导出 Excel
  const exportExcel = async () => {
    try {
      const { columns, rows } = normalizeCatalogTable();
      const payload = {
        name: bestDocTitle(),
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

  // 导出 表格 PDF
  const exportTablePdf = async () => {
    try {
      const { columns, rows } = normalizeCatalogTable();
      const payload = {
        title: bestDocTitle() || "表格导出",
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

      {/* 正文 / Text（保留） */}
      <div style={{ marginBottom: 10 }}>
        <div>正文 / Text：</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="在此输入内容，或使用下方‘目录抓取/写入正文/导出’自动生成"
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
