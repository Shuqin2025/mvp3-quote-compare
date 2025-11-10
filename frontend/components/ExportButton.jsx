// src/components/ExportButton.jsx
import React, { useState } from 'react';
import { exportToXlsx } from '../../export-xlsx';

const ExportButton = ({ items, filename = '商品数据导出.xlsx', withImages = true, style }) => {
  const [loading, setLoading] = useState(false);

  const onExport = async () => {
    if (!Array.isArray(items) || items.length === 0) {
      alert('没有数据可导出！');
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      await exportToXlsx(items, filename, withImages);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={onExport} className="btn btn-primary" style={{ marginBottom: 10, ...(style || {}) }} disabled={loading}>
      {loading ? '导出中…' : '导出 Excel'}
    </button>
  );
};

export default ExportButton;
