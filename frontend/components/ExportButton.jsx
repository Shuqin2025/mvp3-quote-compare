// frontend/src/components/ExportButton.jsx
import React from 'react';
import { exportToXlsxByItems } from '../../export-xlsx.js';

/**
 * 统一导出按钮
 * props:
 *  - items: 已经渲染在表格里的数据行（数组）
 *  - withImages: 是否嵌图
 *  - filename: 导出文件名
 */
const ExportButton = ({ items = [], withImages = true, filename = '商品数据导出.xlsx' }) => {
  const onExport = async () => {
    if (!items || items.length === 0) {
      alert('没有数据可导出');
      return;
    }
    try {
      await exportToXlsxByItems({ items, withImages, filename });
    } catch (err) {
      console.error('导出失败：', err);
      alert('导出失败，请查看控制台日志');
    }
  };

  return (
    <button onClick={onExport} className="btn btn-primary" style={{ marginBottom: '10px' }}>
      ⬇ 导出 Excel（含图片）
    </button>
  );
};

export default ExportButton;

