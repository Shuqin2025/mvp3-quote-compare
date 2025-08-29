import React, { useState } from "react";

/** 统一后端基址：
 *  1) 优先 .env 的 VITE_API_BASE（应包含 /v1/api）
 *  2) 否则用 VITE_API_URL（仅主机），并补上 /v1/api
 *  3) 否则回退到 yunivera-mvp2 的统一后端
 */
function resolveApiBase() {
  const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
  const base = env.VITE_API_BASE?.trim();
  const host = env.VITE_API_URL?.trim();
  if (base) return base.replace(/\/+$/, ""); // 去尾斜杠
  if (host) return (host.replace(/\/+$/, "")) + "/v1/api";
  return "https://yunivera-mvp2.onrender.com/v1/api";
}
const API_BASE = resolveApiBase();

/** 通用：带超时与重试 */
async function fetchJSONWithRetry(url, init = {}, retries = 1, timeoutMs = 45000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      const r = await fetch(url, { ...init, signal: ac.signal, cache: "no-store" });
      clearTimeout(timer);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise((res) => setTimeout(res, 1200));
    }
  }
}

export default function App() {
  const [title, setTitle] = useState("测试报价单");
  const [content, setContent] = useState("这是由前端调用后端 /v1/api/pdf 生成的 PDF，支持中文。");
  const [msg, setMsg] = useState("就绪。");

  async function checkHealth() {
    try {
      setMsg("后端健康检查中……（首次可能唤醒实例，需 20–60 秒）");
      const json = await fetchJSONWithRetry(`${API_BASE}/health?ts=${Date.now()}`, { method: "GET" }, 1, 45000);
      setMsg(`健康检查成功：${JSON.stringify(json)}`);
      alert(`[PING] ${JSON.stringify(json)}`);
    } catch (e) {
      console.error(e);
      setMsg("健康检查失败：Failed to fetch（可能冷启动或瞬断）");
      alert("[PING-ERR] Failed to fetch");
    }
  }

  async function generatePDF() {
    try {
      setMsg("开始生成 PDF …");
      const r = await fetch(`${API_BASE}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      // 兼容两种返回：
      // 1) 直接返回 application/pdf → Blob 下载
      // 2) 返回 JSON { fileUrl: "/files/xxx.pdf" } → 新窗口打开
      const ct = r.headers.get("content-type") || "";
      if (ct.includes("application/pdf")) {
        const blob = await r.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "quote.pdf";
        a.click();
        setMsg("PDF 已生成并下载（Blob）。");
        return;
      }

      let data = {};
      try { data = await r.json(); } catch {}
      if (!r.ok) {
        const msg = `HTTP ${r.status}${data?.error ? " - " + data.error : ""}`;
        throw new Error(msg);
      }
      if (data?.fileUrl) {
        // API_BASE 可能以 /v1/api 结尾，需去掉再拼 /files/xxx.pdf
        const baseHost = API_BASE.replace(/\/v1\/api\/?$/, "");
        window.open(`${baseHost}${data.fileUrl}`, "_blank");
        setMsg("PDF 已生成并在新窗口打开（JSON fileUrl）。");
      } else {
        setMsg("已生成，但后端未返回文件地址。");
        alert("已生成，但未返回文件地址");
      }
    } catch (e) {
      console.error(e);
      setMsg("生成失败：Failed to fetch / 或后端错误");
      alert("生成失败：" + (e.message || "Failed to fetch"));
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial, system-ui, -apple-system" }}>
      <h2>MVP3: 前端调用 /v1/api/pdf Demo</h2>

      <div style={{ marginBottom: 10 }}>
        <label>标题：</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: 400 }} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label>正文：</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ width: 600, height: 120 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <button onClick={checkHealth} style={{ marginRight: 10 }}>
          后端健康检查
        </button>
        <button onClick={generatePDF}>生成 PDF</button>
      </div>

      <div style={{ fontSize: 14, color: "#666" }}>
        API_BASE = <code>{API_BASE}</code>
      </div>

      <div style={{ marginTop: 20, padding: 10, background: "#f5f5f5", borderRadius: 6 }}>
        {msg}
      </div>
    </div>
  );
}
