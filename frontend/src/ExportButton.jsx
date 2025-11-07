import React, { useState } from 'react';

export default function ExportButton({ items = [], apiBase = '', toast = (msg) => alert(msg) }) {
  const [loading, setLoading] = useState(false);

  async function exportExcel() {
    if (!apiBase) {
      toast('❌ 接口地址未配置');
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      toast('⚠️ 没有可导出的数据');
      return;
    }

    if (loading) {
      toast('⏳ 正在导出，请稍候...');
      return;
    }

    try {
      setLoading(true);
      toast('📦 正在导出 Excel，请稍候...');

      const resp = await fetch(`${apiBase}/v1/api/export-xlsx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, withImages: true }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`导出失败，状态码 ${resp.status}: ${errText}`);
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast('✅ 导出成功');
    } catch (err) {
      console.error('[Export Error]', err);
      toast(`❌ 导出失败：${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={exportExcel}
      disabled={loading}
      style={{
        padding: '6px 12px',
        background: loading ? '#ccc' : '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: 4,
        cursor: loading ? 'not-allowed' : 'pointer',
        marginLeft: 12,
      }}
    >
      {loading ? '导出中...' : '导出 Excel (.xlsx)'}
    </button>
  );
}
