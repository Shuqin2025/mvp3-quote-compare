import React from 'react';

export default function ExportButton({ items, apiBase, toast }) {
  async function exportExcel() {
    if (!apiBase) return toast?.('缺少后端 API 地址参数');
    if (!items || items.length === 0) return toast?.('无数据可导出');

    toast?.('正在导出 Excel 文件...');
    try {
      const resp = await fetch(`${apiBase}/v1/api/export-xlsx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, withImages: true }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        console.warn('[Export Error]', txt);
        throw new Error(`HTTP ${resp.status}`);
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'export.xlsx';
      a.click();
      URL.revokeObjectURL(url);

      toast?.('✅ Excel 导出完成');
    } catch (err) {
      console.error('[Export Error]', err);
      toast?.('❌ 导出失败，请检查控制台');
    }
  }

  return (
    <button className="btn primary" onClick={exportExcel}>
      导出 Excel（.xlsx）
    </button>
  );
}
