// 取 API 根地址（保持你现在的写法即可）
const API = import.meta.env.VITE_API_URL;

// 一个通用的超时 fetch（30s）
const fetchWithTimeout = (url, opts = {}, timeoutMs = 30000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const finalOpts = { ...opts, signal: controller.signal };
  return fetch(url, finalOpts).finally(() => clearTimeout(id));
};

// 健康检查
async function handlePing(setStatus) {
  setStatus("后端健康检查中……");
  try {
    const res = await fetchWithTimeout(`${API}/health`, { method: "GET" }, 30000);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} ${txt}`);
    }
    const json = await res.json();
    setStatus(`健康检查成功: ${JSON.stringify(json)}`);
  } catch (err) {
    setStatus(`健康检查失败: ${String(err.message || err)}`);
  }
}

// 生成 PDF
async function handleGeneratePDF(title, content, setStatus) {
  setStatus("开始生成 PDF …");
  try {
    const res = await fetchWithTimeout(`${API}/v1/api/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content })
    }, 60000); // 生成 PDF 给 60s 更稳

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} ${txt}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    // 方式一：新窗口打开
    window.open(url, "_blank");
    // 方式二：直接下载（任选其一）
    // const a = document.createElement("a");
    // a.href = url;
    // a.download = "quote.pdf";
    // a.click();

    setStatus("已生成 PDF（如果浏览器拦截了弹窗，请允许）。");
    // 可选：稍后释放 URL
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    setStatus(`生成失败：${String(err.message || err)}`);
  }
}
