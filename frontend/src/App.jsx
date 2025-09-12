// frontend/src/App.jsx
import React, { useMemo, useRef, useState } from "react";

/**
 * MVP3 — 目录抓取 + 导出（固定列序：Item No | Picture | Description | MOQ | Unit Price | Link）
 * - API_BASE 优先级：?api= > VITE_API_BASE > VITE_API_URL > fallback
 */
const fallbackAPI = "https://yunivera-mvp2-cwyr.onrender.com";

export default function App() {
  const API_BASE = useMemo(() => {
    const envA = import.meta?.env?.VITE_API_BASE?.trim?.();
    const envB = import.meta?.env?.VITE_API_URL?.trim?.();
    const qp = (() => {
      try { return new URL(location.href).searchParams.get("api")?.trim(); }
      catch { return ""; }
    })();
    return qp || envA || envB || fallbackAPI;
  }, []);

  const [catalogUrl, setCatalogUrl] = useState("");
  const [json, setJson] = useState("");
  const [health, setHealth] = useState("");
  const boxRef = useRef(null);

  const alertMsg = (m) => { try { alert(m); } catch { console.log(m); } };

  async function postJSON(path, payload) {
    const r = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
    return r.json();
  }

  async function doPing() {
    try {
      const r = await fetch(`${API_BASE}/v1/api/health`);
      setHealth(`OK ${r.status}`);
      alertMsg("后端健康检查成功");
    } catch (e) {
      setHealth(`FAIL ${e.message}`);
      alertMsg(`后端健康检查失败：${e.message}`);
    }
  }

  async function doParse() {
    if (!catalogUrl.trim()) return alertMsg("请粘贴目录页 URL");
    try {
      const data = await postJSON("/v1/api/catalog/parse", { url: catalogUrl, limit: 100 });
      setJson(JSON.stringify(data, null, 2));
      setTimeout(() => boxRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
    } catch (e) {
      alertMsg(`抓取失败：${e.message}`);
    }
  }

  function getRows() {
    if (!json) throw new Error("请先抓取目录");
    const obj = JSON.parse(json);
    const list = obj?.items || obj?.products || [];
    if (!Array.isArray(list) || list.length === 0) throw new Error("结果中无 items/products");

    // 标准化成后端 Excel 需要的字段名
    return list.map((p) => ({
      sku:   p.sku || "",
      image: p.image || p.img || (Array.isArray(p.images) ? p.images[0] : ""),
      title: p.title || p.name || "",
      moq:   p.moq   ?? "",
      price: p.price ?? "",
      url:   p.url || p.link || "",
    }));
  }

  async function exportExcel() {
    try {
      const rows = getRows();
      const r = await fetch(`${API_BASE}/v1/api/export/excel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        body: JSON.stringify({ rows }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "catalog.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alertMsg(`导出失败：${e.message}`);
    }
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button onClick={() => window.i18n?.setLang?.("zh")}>CN 中文</button>
        <button onClick={() => window.i18n?.setLang?.("de")}>DE Deutsch</button>
        <button onClick={() => window.i18n?.setLang?.("en")}>GB English</button>
      </div>

      <h2>MVP3 — App</h2>
      <div style={{ color: "#0a7a0a", background: "#eaf8ea", padding: 8, borderRadius: 6 }}>
        这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。
      </div>

      <div style={{ marginTop: 12, color: "#666" }}>
        API：<code>{API_BASE}/v1/api</code>　PING：<code>{health || "未检查"}</code>
        <button style={{ marginLeft: 8 }} onClick={doPing}>后端健康检查</button>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
        <input
          value={catalogUrl}
          onChange={(e) => setCatalogUrl(e.target.value)}
          placeholder="粘贴要抓的目录页 URL（例如 s-impuls 的分类页）"
          style={{ flex: 1, height: 30, padding: "0 8px" }}
        />
        <button onClick={doParse}>抓取目录</button>
        <select defaultValue="100" title="预览条数（后端已限制）">
          <option value="50">预览（前 50 条）</option>
          <option value="100">预览（前 100 条）</option>
        </select>
        <button onClick={exportExcel}>导出 Excel（.xlsx）</button>
      </div>

      <div ref={boxRef} style={{ marginTop: 12 }}>
        <textarea
          value={json}
          readOnly
          placeholder="抓取结果 JSON 会显示在这里"
          style={{ width: "100%", height: 260, padding: 8 }}
        />
      </div>
    </div>
  );
}
