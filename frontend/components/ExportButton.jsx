// frontend/src/components/ExportButton.jsx
import React from 'react';

/**
 * 用法：
 * <ExportButton
 *   items={rows}         // 可选：如果你已经在前端拿到解析后的 rows，传这里（会走 POST）
 *   url={catalogUrl}     // 可选：如果只想后端按目录 URL 去抓取导出（会走 GET）
 *   limit={50}           // 可选：GET 导出的数量限制
 *   withImages={true}    // 可选：要求后端嵌图
 * />
 *
 * 说明：
 * - 优先 POST /v1/api/export-xlsx 以便把当前 rows 直接交给后端导出（图像也会二次尝试）
 * - 若 items 为空但传入了 url，则退回 GET /v1/export-xlsx?url=...&limit=...
 * - API_BASE 来自 window.API_BASE（例如 https://yunivera-gateway.onrender.com）
 */
const ExportButton = ({ items = [], url = '', limit = 50, withImages = true }) => {
  const apiBase = (typeof window !== 'undefined' && window.API_BASE) || '';

  const exportToExcel = async () => {
    try {
      if ((!items || items.length === 0) && !url) {
        alert('没有可导出的数据；请先抓取或提供目录 URL。');
        return;
      }

      // —— 优先 POST：把当前 items 直接交给后端导出（含图片嵌入）
      if (items && items.length > 0) {
        const api = `${apiBase}/v1/api/export-xlsx`;
        const resp = await fetch(api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, withImages }),
        });
        if (!resp.ok) throw new Error(`导出失败：HTTP ${resp.status}`);
        const blob = await resp.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'catalog.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
        return;
      }

      // —— 退回 GET：仅给目录 URL，后端自行抓取并导出
      if (url) {
        const api = `${apiBase}/v1/export-xlsx?url=${encodeURIComponent(url)}&limit=${limit}`;
        const a = document.createElement('a');
        a.href = api;
        a.download = 'catalog.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
    } catch (err) {
      console.error('[ExportButton] export failed:', err);
      alert('导出失败，请查看控制台日志或稍后再试。');
    }
  };

  return (
    <button onClick={exportToExcel} style={{ height: 40, padding: '0 14px', borderRadius: 8 }}>
      导出 Excel
    </button>
  );
};

export default ExportButton;
