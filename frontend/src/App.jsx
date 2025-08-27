import React, { useState } from "react";

const API = "https://mvp3-quote-compare-backend.onrender.com";

// 通用：带超时与重试的 JSON 请求
async function fetchJSONWithRetry(url, init = {}, retries = 2, timeoutMs = 45000) {
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
      // 等 1.5 秒再重试（Render 冷启动时很有用）
      await new Promise(res => setTimeout(res, 1500));
    }
  }
}

function App() {
  const [title, setTitle] = useState("测试报价单");
  const [content, setContent] = useState("这是由前端调用后端 /v1/api/pdf 生成的 PDF，支持中文。");
  const [msg, setMsg] = useState("就绪。");

  // 健康检查
  async function checkHealth() {
    try {
      const url = `${API}/v1/health?ts=${Date.now()}`;
      setMsg("后端健康检查中……（如在唤醒后端，可能要 20–60 秒）");

      const json = await fetchJSONWithRetry(url, { method: "GET" }, 2, 45000);

      setMsg(`健康检查成功：${JSON.stringify(json)}`);
      alert(`[PING]${JSON.stringify(json)}`);
    } catch (e) {
      console.error(e);
      setMsg("健康检查失败：Failed to fetch（可能是后端刚被唤醒未及时响应，或网络瞬断）");
      alert("[PING-ERR] Failed to fetch");
    }
  }

  // 生成 PDF
  async function generatePDF() {
    try {
      setMsg("开始生成 PDF …");
      const r = await fetch(`${API}/v1/api/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      const blob = await r.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "quote.pdf";
      a.click();
      setMsg("PDF 已生成并下载。");
    } catch (e) {
      console.error(e);
      setMsg("生成失败：Failed to fetch");
      alert("生成失败：Failed to fetch");
    }
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2>MVP3: 前端调用 /v1/api/pdf Demo</h2>

      <div style={{ marginBottom: "10px" }}>
        <label>标题：</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "400px" }}
        />
      </div>

      <div style={{ marginBottom: "10px" }}>
        <label>正文：</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ width: "600px", height: "120px" }}
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <button onClick={checkHealth} style={{ marginRight: "10px" }}>
          后端健康检查
        </button>
        <button onClick={generatePDF}>生成 PDF</button>
      </div>

      <div style={{ fontSize: "14px", color: "#666" }}>
        API = {API}
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "10px",
          background: "#f5f5f5",
          borderRadius: "6px",
        }}
      >
        {msg}
      </div>
    </div>
  );
}

export default App;
