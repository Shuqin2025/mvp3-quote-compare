// frontend/src/boot/ExportButton.jsx
import React from 'react';

const ExportButton = ({ items }) => {
  const exportToExcel = async () => {
    if (!items || items.length === 0) {
      alert('没有数据可导出');
      return;
    }

    try {
      const response = await fetch('/v1/api/export-xlsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, withImages: true }),
      });

      if (!response.ok) throw new Error('导出失败');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '商品数据导出.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[导出失败]', err);
      alert('导出失败，请查看控制台');
    }
  };

  return (
    <button onClick={exportToExcel} style={{ marginBottom: '10px' }}>
      ⬇ 导出 Excel
    </button>
  );
};

export default ExportButton;
