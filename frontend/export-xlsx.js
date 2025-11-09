// export-xlsx.js
// 前端导出：支持两种来源
// A) 直接传列表页 URL：GET /v1/api/export-xlsx?url=...&limit=...
// B) 传入已在前端表格里的 items：POST /v1/api/export-xlsx（可选 withImages）

/**
 * 方式一：给目录页 URL，后端自行抓取并写入图片到 .xlsx
 * @param {string} listUrl
 * @param {number} limit
 */
export async function exportToXlsxByUrl(listUrl, limit = 50) {
  if (!listUrl) throw new Error("缺少目录链接");
  const base = (window.API_BASE || "").replace(/\/+$/, ""); // 可为空：则用相对路径
  const url = `${base}/v1/api/export-xlsx?url=${encodeURIComponent(listUrl)}&limit=${encodeURIComponent(limit)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`导出失败：HTTP ${res.status} ${res.statusText} ${text}`);
  }

  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "export.xlsx";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 0);
}

/**
 * 方式二：传已在前端渲染的 items（含 img 时可让后端代抓并写入）
 * @param {Array<object>} items
 * @param {boolean} withImages
 */
export async function exportToXlsx(items = [], withImages = true) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("没有可导出的数据");
  }
  const base = (window.API_BASE || "").replace(/\/+$/, "");
  const url = `${base}/v1/api/export-xlsx`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, withImages }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`导出失败：HTTP ${res.status} ${res.statusText} ${text}`);
  }

  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "export.xlsx";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 0);
}

// 可选：也暴露到 window，便于控制台/行内 onclick 调用
if (typeof window !== "undefined") {
  window.exportToXlsx = exportToXlsx;
  window.exportToXlsxByUrl = exportToXlsxByUrl;
}
