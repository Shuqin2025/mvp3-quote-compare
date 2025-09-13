// --- i18n 兜底：无论 i18n.js 是否加载成功，这里都不会报错 ---
const T = (key, vars = {}) => {
  try {
    if (window.i18n && typeof window.i18n.t === 'function') {
      return window.i18n.t(key, vars);
    }
  } catch (e) {}
  const fallback = {
    'link_text': '链接',
    'toast_zero': '暂无数据（预览前 {{m}} 条）',
    'toast_success': '抓取成功：共 {{n}} 条（预览前 {{m}} 条）',
    'export_generating': '正在生成 Excel…',
    'export_done': 'Excel 已导出',
    'export_fail': '导出失败'
  };
  let txt = fallback[key] || key;
  Object.keys(vars || {}).forEach(k => {
    txt = txt.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), vars[k]);
  });
  return txt;
};

/* ui-enhance.js — MVP3 前端逻辑（抓取 + 富化 + 导出内嵌图） */
(function () {
  const $url = document.getElementById('txtUrl');
  const $btnFetch = document.getElementById('btnFetch');
  const $btnExport = document.getElementById('btnExport');
  const $btnClear = document.getElementById('btnClear');
  const $selPreview = document.getElementById('selPreview');
  const $toast = document.getElementById('toast');

  // ... 保持前面的 fetch / normalizeItems / ab2b64 / fetchProxyImageAsBase64 等函数不变 ...

  async function exportExcelWithImages(rows) {
    if (!rows || !rows.length) {
      showToast(false, T('export_fail'));
      return;
    }

    // ✅ 开始导出前提示
    if (window.__showToast) {
      window.__showToast(true, T('export_generating'));
    } else {
      showToast(true, T('export_generating'));
    }

    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Items');
      ws.addRow(['#', 'Item No.', 'Picture', 'Description', 'MOQ', 'Unit Price', T('link_text')]);
      ws.getColumn(1).width = 5;
      ws.getColumn(2).width = 14;
      ws.getColumn(3).width = 14;
      ws.getColumn(4).width = 60;
      ws.getColumn(5).width = 10;
      ws.getColumn(6).width = 14;
      ws.getColumn(7).width = 30;

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const excelRow = ws.addRow([
          i + 1, r.sku || '', '', r.title || '',
          r.moq || '', r.price || '',
          r.url ? { text: T('link_text'), hyperlink: r.url } : ''
        ]);
        excelRow.height = 52;
        if (r.img) {
          try {
            const b64 = await fetchProxyImageAsBase64(r.img);
            if (b64) {
              const ext = (r.img.split('.').pop() || 'jpg').toLowerCase();
              const usePng = ext.includes('png');
              const mime = usePng ? 'image/png' : 'image/jpeg';
              const imageId = wb.addImage({
                base64: `data:${mime};base64,${b64}`,
                extension: usePng ? 'png' : 'jpeg'
              });
              const rowIdx = excelRow.number;
              ws.addImage(imageId, {
                tl: { col: 2, row: rowIdx - 1 },
                ext: { width: 90, height: 50 }
              });
            }
          } catch {}
        }
      }

      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf]), `yunivera-${Date.now()}.xlsx`);
      // ✅ 导出成功后提示
      if (window.__showToast) {
        window.__showToast(true, T('export_done'));
        setTimeout(() => window.__hideToast && window.__hideToast(), 1500);
      } else {
        showToast(true, T('export_done'));
        setTimeout(hideToast, 1500);
      }

    } catch (err) {
      console.error('[export:fail]', err);
      showToast(false, `${T('export_fail')}: ${String(err.message || err)}`);
    }
  }

  async function handleExport() {
    try {
      if (!__rows || !__rows.length) {
        showToast(false, T('toast_zero', { m: 0 }));
        return;
      }
      await exportExcelWithImages(__rows);
    } catch (err) {
      console.error('[export:fail]', err);
      showToast(false, `${T('export_fail')}: ${String(err.message || err)}`);
    }
  }

  if ($btnFetch) $btnFetch.addEventListener('click', handleFetch);
  if ($btnExport) $btnExport.addEventListener('click', handleExport);
  if ($btnClear) $btnClear.addEventListener('click', handleClear);

  if ($url) $url.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleFetch(); });
})();
