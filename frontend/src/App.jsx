import React, { useMemo, useRef, useState } from "react";

/**
 * MVP3 前端（还原版）— 去掉 1688/Amazon 专用功能
 * - 读取后端 API 基址：VITE_API_URL，默认回退 https://yunivera-mvp2.onrender.com
 * - /v1/api/health  健康检查
 * - /v1/api/pdf     生成 PDF（返回 application/pdf）
 * - /v1/api/scrape  单页抓取
 * - /v1/api/catalog/parse  目录抓取
 */

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

  // 目录抓取 Demo
  const [catalogUrl, setCatalogUrl] = useState("https://example.com");
  const [catalogJson, setCatalogJson] = useState("");

  // 运行状态
  const busyRef = useRef(false);

  const alertMsg = (msg) => {
    try {
      // 兼容桌面浏览器
      window.alert(msg);
    } catch (e) {
      console.log(msg);
    }
  };

  const fetchJson = async (path, payload) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload ?? {}),
    });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status} - ${errText || "request failed"}`);
    }
    if (ct.includes("application/json")) {
      return res.json();
    }
    // 有些接口可能返回纯文本
    return res.text();
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

  const doGeneratePdf = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const payload = {
        title: title?.trim() || "未命名文档",
        text: text?.trim() || "",
        // 可选：抬头 LOGO & 来源链接（后端用或忽略都兼容）
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

      // 后端本就返回 Content-Type: application/pdf；如果 500 就会抛异常
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`HTTP ${res.status} | ${msg}`);
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "quote.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);

      alertMsg("PDF 已生成并开始下载。");
    } catch (e) {
      alertMsg(`PDF 生成失败：${e.message}`);
      console.error(e);
    } finally {
      busyRef.current = false;
    }
  };

  const doScrape = async () => {
    if (!url?.trim()) {
      return alertMsg("请先输入要抓取的网页链接。");
    }
    try {
      const data = await fetchJson("/v1/api/scrape", { url: url.trim() });
      setScrapeJson(JSON.stringify(data, null, 2));
    } catch (e) {
      setScrapeJson(`抓取失败：${e.message}`);
      alertMsg(`抓取失败：${e.message}`);
    }
  };

  // “回填（基础）”：把 scrape 的结果回填到标题/正文（拆最基础字段）
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
      // 用简短的概览补全正文，不覆盖用户已有内容（只追加）
      const addition = [
        "【基本信息】",
        `名称: ${t || "（未识别）"}`,
        `URL: ${obj?.url || "（未知）"}`,
        obj?.preview ? `简介: ${obj.preview}` : "",
        "",
      ]
        .filter(Boolean)
        .join("\n");
      setText((old) => (old ? `${old}\n\n${addition}` : addition));
      alertMsg("已回填基础信息。");
    } catch (e) {
      alertMsg(`回填失败：${e.message}`);
    }
  };

  // “智能回填”：占位（以后打通你后端智能抽取接口再接上）
  const doFillSmart = async () => {
    if (!scrapeJson) return alertMsg("请先抓取，再回填。");
    try {
      // 这里预留：你将来可能是 /v1/api/smart/parse 之类
      // const smart = await fetchJson("/v1/api/smart/parse", { html: ... });
      // 先用基础回填代替
      doFillBasic();
    } catch (e) {
      alertMsg(`智能回填失败：${e.message}`);
    }
  };

  const doCatalogParse = async () => {
    if (!catalogUrl?.trim()) {
      return alertMsg("请先输入目录页链接。");
    }
    try {
      const data = await fetchJson("/v1/api/catalog/parse", {
        url: catalogUrl.trim(),
      });
      setCatalogJson(JSON.stringify(data, null, 2));
    } catch (e) {
      setCatalogJson(`目录抓取失败：${e.message}`);
      alertMsg(`目录抓取失败：${e.message}`);
    }
  };

  // 把目录 JSON 的前 N 条写入正文
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

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px" }}>
      <h2 style={{ margin: "0 0 14px" }}>
        MVP3：Scrapen + Ausfüllen + PDF erzeugen
      </h2>

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
        <span style={{ color: "#888" }}>
          [PING] {health || "尚未检查"}
        </span>
      </div>

      <div style={{ marginTop: 6, color: "#666", fontSize: 12 }}>
        API 基址 / API-Basis：{" "}
        <code>{API_BASE}/v1/api</code>
      </div>

      {/* Web-Scraping & 一键回填 */}
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

      {/* 目录抓取 Demo */}
      <div style={{ marginTop: 24 }}>
        <h3>📚 目录抓取 Demo（/v1/api/catalog/parse）</h3>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={catalogUrl}
            onChange={(e) => setCatalogUrl(e.target.value)}
            style={{ flex: 1, height: 28, padding: "0 8px" }}
            placeholder="https://example.com"
          />
          <button onClick={doCatalogParse}>抓取目录</button>
          <button onClick={() => writeCatalogToText(50)}>
            目录写入正文（前 50 条）
          </button>
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
