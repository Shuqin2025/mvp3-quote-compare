// src/components/ExportButton.jsx
// A single, canonical export button for the app.
// Make sure the import path to export-xlsx.js is correct for your repo layout.
import React, { useState } from 'react';
import { exportToXlsx } from '../../export-xlsx.js'; // adjust if export-xlsx.js lives elsewhere

/**
 * Props:
 * - items: Array<object> already normalized for backend
 * - label?: string (button text)
 * - filename?: string
 */
export default function ExportButton({ items = [], label = '导出 Excel', filename = '商品数据导出.xlsx' }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!items || items.length === 0) {
      alert('没有数据可导出');
      return;
    }
    try {
      setLoading(true);
      await exportToXlsx(items, { withImages: true, filename });
    } catch (err) {
      console.error('导出失败: ', err);
      alert('导出失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleExport} disabled={loading} style={{ marginBottom: '10px' }}>
      {loading ? '导出中…' : label}
    </button>
  );
}
