// frontend/export-xlsx.js
// 统一导出工具：只暴露两个入口，页面其它地方一律不要直接 fetch /v1/export-xlsx

function getApiBase() {
  const meta = document.querySelector('meta[name="api-base"]');
  return (meta && meta.content) || '/v1/api';
}

// 统一图片代理（给其它地方用到时也能导入）
export function imageProxy(originalUrl, format = 'raw') {
  const API_BASE = getApiBase();
  const url = `${API_BASE}/image?format=${encodeURIComponent(format)}&url=${encodeURIComponent(originalUrl)}`;
  return url;
}

/**
 * 直接用前端已有的 items 列表导出
 * @param {Array<object>} items 规范化后的行数据
 * @param {string} [filename='导出.xlsx'] 下载文件名
 * @param {boolean} [withImages=true] 是否内嵌图片
 */
export async function exportToXlsx(items, filename = '导出.xlsx', withImages = true) {
  if (!Array.isArray(items) || items.length === 0) {
    alert('没有可导出的数据');
    return;
  }
  const API_BASE = getApiBase();
  try {
    const resp = await fetch(`${API_BASE}/export-xlsx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, withImages: !!withImages }),
    });
    if (!resp.ok) throw new Error(`导出失败：${resp.status}`);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || '导出.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('导出异常', err);
    alert('导出失败，请稍后重试');
  }
}

/**
 * 让后端自己去抓某个目录页并导出
 * @param {string} url 目录页地址
 * @param {number} [limit=50] 限制条数
 * @param {string} [filename='导出.xlsx'] 下载文件名
 * @param {boolean} [withImages=true] 是否内嵌图片
 */
export async function exportUrlToXlsx(url, limit = 50, filename = '导出.xlsx', withImages = true) {
  if (!url) {
    alert('缺少目录页 URL');
    return;
  }
  const API_BASE = getApiBase();
  try {
    const resp = await fetch(`${API_BASE}/export-xlsx?url=${encodeURIComponent(url)}&limit=${encodeURIComponent(limit)}&withImages=${withImages ? '1' : '0'}`, {
      method: 'GET',
    });
    if (!resp.ok) throw new Error(`导出失败：${resp.status}`);
    const blob = await resp.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = obj;
    a.download = filename || '导出.xlsx';
    a.click();
    URL.revokeObjectURL(obj);
  } catch (err) {
    console.error('导出异常', err);
    alert('导出失败，请稍后重试');
  }
}
