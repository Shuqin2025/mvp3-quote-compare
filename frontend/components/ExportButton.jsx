// frontend/src/components/ExportButton.jsx
import React, { useState } from "react";

/**
 * props:
 *   items: 要导出的行数据数组（你列表里显示的那份）
 *   withImages: boolean 是否强制嵌图（默认 true）
 *   filename: 导出文件名（默认 catalog.xlsx）
 *   apiBase: 可选，自定义后端前缀（默认 window.location.origin + '/v1/api'）
 */
export default function ExportButton({
  items = [],
  withImages = true,
  filename = "catalog.xlsx",
  apiBase,
}) {
  const [loading, setLoading] = useState(false);

  const doExport = async () => {
    if (!items || items.length === 0) {
      alert("没找到要导出的数据～");
      return;
    }
    const base = apiBase || `${window.location.origin}/v1/api`;
    const url = `${base}/export-xlsx`;

    try {
      setLoading(true);
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, withImages: !!withImages }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`导出失败：${resp.status} ${resp.statusText} ${text}`);
      }

      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(a.href);
      a.remove();
    } catch (err) {
      console.error(err);
      alert("导出失败，请在控制台查看详细报错。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={doExport} disabled={loading} style={{ marginBottom: 10 }}>
      {loading ? "正在导出…" : "导出 Excel"}
    </button>
  );
}
