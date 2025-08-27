// frontend/src/App.jsx
import React, { useState } from "react";

/**
 * 优先读取部署环境的后端 URL：
 * - VITE_API_BASE 或 VITE_API_URL（Render -> Environment Variables 里设置）
 * - 都没有时，回退到 http://localhost:5190
 */
const API = (
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL  ||
  "http://localhost:5190"
).replace(/\/+$/, ""); // 去掉末尾斜杠，避免 //v1 这种

export default function App() {
  const [title, setTitle] = useState("测试报价单");
  const [content, setContent] = useState("这是由前端调用后端 /v1/api/pdf 生成的 PDF，支持中文。");
  const [log, setLog] = useState("就绪。");

  const ping = async () => {
    setLog("后端健康检查中……");
    try {
      const res = await fetch(`${API}/health`);
      const text = await res.text();
      setLog(`健康检查成功：${text}`);
      alert(`【PING】${text}`);
    } catch (e) {
      setLog(`健康检查失败：${e.message}`);
      alert(`【PING-ERR】${e.message}`);
    }
  };

  const genPDF = async () => {
    setLog("开始生成 PDF …");
    try {
      const resp = await fetch(`${API}/v1/api/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      // 调试用：把状态码写在日志里方便排错
      setLog(`【COMPARE】status=${resp.status}`);

      // 成功：后端返回 PDF 的二进制流
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e) {
      setLog(`生成失败：${e.message}`);
      alert(`生成失败：${e.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 820, margin: "40px auto", lineHeight: 1.6 }}>
      <h2>MVP3：前端调用 /v1/api/pdf Demo</h2>

      <div style={{ marginBottom: 12 }}>
        <div>标题：</div>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ width: "100%", padding: 8 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div>正文：</div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={6}
          style={{ width: "100%", padding: 8 }}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <button onClick={ping} style={{ marginRight: 10 }}>后端健康检查</button>
        <button onClick={genPDF}>生成 PDF</button>
      </div>

      <div style={{ fontSize: 12, color: "#555", marginBottom: 10 }}>
        API = {API}
      </div>

      <div style={{ background: "#f6f6f6", padding: 10, borderRadius: 6 }}>
        {log}
      </div>
    </div>
  );
}
