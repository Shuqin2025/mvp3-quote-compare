// frontend/src/App.jsx
import React, { useState } from 'react';

const API = import.meta.env.VITE_API_URL; // 由 Render 环境变量注入

export default function App() {
  const [title, setTitle] = useState('测试报价单');
  const [content, setContent] = useState('这是由前端调用后端 /v1/api/pdf 生成的 PDF，支持中文。');
  const [msg, setMsg] = useState('就绪。');

  async function checkHealth() {
    try {
      setMsg('后端健康检查中……');
      const r = await fetch(`${API}/v1/health`, { cache: 'no-store' });
      const json = await r.json();
      setMsg(`健康检查成功：${JSON.stringify(json)}`);
      alert(`[PING]${JSON.stringify(json)}`);
    } catch (e) {
      console.error(e);
      setMsg('健康检查失败：Failed to fetch');
      alert('[PING-ERR] Failed to fetch');
    }
  }

  async function makePDF() {
    try {
      setMsg('开始生成 PDF …');
      const r = await fetch(`${API}/v1/api/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(text || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      // 新窗口打开；也可改为下载：创建 <a download> 点击
      window.open(url, '_blank');
      setMsg('PDF 已生成。');
      // 过一会儿释放 URL
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error(e);
      setMsg('生成失败：Failed to fetch');
      alert('生成失败：Failed to fetch');
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '40px auto', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial' }}>
      <h1>MVP3：前端调用 /v1/api/pdf Demo</h1>

      <div style={{ margin: '12px 0' }}>
        <label>标题：</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="标题"
          aria-label="标题"
          style={{ width: '100%', padding: 8 }}
        />
      </div>

      <div style={{ margin: '12px 0' }}>
        <label>正文：</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="正文"
          aria-label="正文"
          rows={6}
          style={{ width: '100%', padding: 8 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={checkHealth}>后端健康检查</button>
        <button onClick={makePDF}>生成 PDF</button>
      </div>

      <p style={{ color: '#666', fontSize: 12, marginTop: 10 }}>
        API = {API}
      </p>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          background: '#f6f7f8',
          borderRadius: 6
        }}
      >
        {msg}
      </div>
    </div>
  );
}
