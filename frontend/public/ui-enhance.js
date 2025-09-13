/* Yunivera DataBridge – UI helpers (browser) */
(() => {
  // 幂等保护：防止脚本被多次注入后重复绑定事件
  if (window.__udb_inited) return;
  window.__udb_inited = true;

  // -------- i18n 简便封装 --------
  const T = (k, params) => {
    try {
      return (window.i18n && window.i18n.t) ? window.i18n.t(k, params) : k;
    } catch { return k; }
  };

  // -------- DOM --------
  const $txtUrl   = document.getElementById('txtUrl');
  const $btnFetch = document.getElementById('btnFetch');
  const $btnExport= document.getElementById('btnExport');
  const $btnClear = document.getElementById('btnClear');
  const $selLimit = document.getElementById('selLimit');
  const $tbl      = document.getElementById('tbl');            // 表格
  const $tbody    = document.getElementById('tbody');          // 表体
  const $empty    = document.getElementById('empty');          // 空白占位
  const $preview  = document.getElementById('selPreview');     // API 基址显示用（隐藏 input）
  const API_BASE  = (document.currentScript?.dataset?.api) || new URLSearchParams(location.search).get('api') || '';

  // 成功/失败提示
  let toastTimer = null;
  const showToast = (ok, msg) => {
    const el = document.getElementById('toast');
    el.textContent = msg || '';
    el.className = `toast ${ ok ? 'toast-ok' : 'toast-warn' }`;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2800);
  };

  // 渲染表格
  const renderRows = (rows) => {
    $tbody.innerHTML = '';
    if (!rows || !rows.length) {
      $tbl.style.display = 'none';
      $empty.style.display = 'block';     // 空白占位
      return;
    }
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${r.sku || ''}</td>
        <td><img src="${r.img || ''}" style="height:36px" onerror="this.style.opacity=0.2"/></td>
        <td>${r.title || ''}</td>
        <td>${r.moq   || ''}</td>
        <td>${r.price || ''}</td>
        <td><a href="${r.url || '#'}" target="_blank">${T('link_text') || 'link_text'}</a></td>
      `;
      $tbody.appendChild(tr);
    });
    $empty.style.display = 'none';
    $tbl.style.display = 'table';
  };

  // 拉取目录
  const handleFetch = async () => {
    const url = ($txtUrl.value || '').trim();
    if (!url) { showToast(false, T('toast_need_url') || '请输入链接'); return; }
    try {
      const api = (API_BASE || '').replace(/\/?$/, '');
      const u = `${api}/v1/api/catalog/parse?url=${encodeURIComponent(url)}`;
      const t0 = Date.now();
      const res = await fetch(u);
      if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
      const data = await res.json();
      // 兼容旧后端字段名 {ok,count,products/items}
      const rows = data.products || data.items || [];
      const n = data.count ?? rows.length ?? 0;
      renderRows(rows.slice(0, Number($selLimit.value || 50)));
      showToast(true, (T('toast_success') || '抓取成功：共 {n} 条').replace('{n}', n));
    } catch (err) {
      showToast(false, `${T('toast_fail') || '抓取失败'}: ${err.message || err}`);
      console.error(err);
    }
  };

  // 导出 Excel（内嵌真实图片）
  const handleExport = async () => {
    try {
      const rows = [...$tbody.querySelectorAll('tr')];
      if (!rows.length) { showToast(false, T('toast_zero') || '暂无数据'); return; }

      if (!window.ExcelJS) throw new Error('ExcelJS not loaded');
      const api = (API_BASE || '').replace(/\/?$/, '');

      showToast(true, T('toast_exporting') || '正在生成 Excel…');

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Items');

      // 表头
      ws.columns = [
        { header: '#',        key: '_',     width: 4  },
        { header: T('col_sku')   || 'Item No.', key: 'sku',  width: 12 },
        { header: T('col_pic')   || 'Picture',  key: 'pic',  width: 14 },
        { header: T('col_desc')  || 'Description', key:'title', width: 80 },
        { header: 'MOQ', key:'moq', width: 10 },
        { header: T('col_price') || 'Unit Price', key:'price', width: 12 },
        { header: T('col_link')  || 'Link', key:'link', width: 16 },
      ];

      const data = [];
      // 收集数据（从当前表格）
      $tbody.querySelectorAll('tr').forEach((tr) => {
        const tds = tr.querySelectorAll('td');
        data.push({
          idx:   tds[0]?.textContent.trim(),
          sku:   tds[1]?.textContent.trim(),
          img:   tr.querySelector('img')?.getAttribute('src') || '',
          title: tds[3]?.textContent.trim(),
          moq:   tds[4]?.textContent.trim(),
          price: tds[5]?.textContent.trim(),
          url:   tr.querySelector('a')?.getAttribute('href') || ''
        });
      });

      const picCol = 3; // 列 B=2, C=3 ...
      let r = 2;        // 从第2行开始写数据
      for (const item of data) {
        ws.addRow([item.idx, item.sku, '', item.title, item.moq, item.price, (T('link_text')||'link_text')]).commit?.();
        ws.getCell(r, 7).value = { text: (T('link_text')||'link_text'), hyperlink: item.url || '' };

        // 图片（通过后端代理拿二进制）
        if (item.img) {
          try {
            const imRes = await fetch(`${api}/v1/api/image?url=${encodeURIComponent(item.img)}`);
            if (imRes.ok) {
              const ct = imRes.headers.get('content-type') || '';
              const ext = /png/.test(ct) ? 'png' : 'jpeg';
              const buf = await imRes.arrayBuffer();
              const imgId = wb.addImage({ buffer: buf, extension: ext });
              ws.getRow(r).height = 56;                   // 行高
              ws.addImage(imgId, `C${r}:C${r}`);          // C 列单元格内嵌
            }
          } catch (e) { /* 单图失败不影响整体 */ }
        }
        r++;
      }

      const ab = await wb.xlsx.writeBuffer();
      const blob = new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `yunivera-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      showToast(false, `${T('toast_export_fail') || '导出失败'}：${err.message || err}`);
      console.error(err);
    }
  };

  // 清空
  const handleClear = () => {
    $tbody.innerHTML = '';
    $tbl.style.display = 'none';
    $empty.style.display = 'block';
  };

  // 事件绑定
  $btnFetch?.addEventListener('click', handleFetch);
  $btnExport?.addEventListener('click', handleExport);
  $btnClear?.addEventListener('click', handleClear);

  // 回车键抓取
  $txtUrl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleFetch();
  });

  // 首次进入显示 API 基址（隐藏域）
  if ($preview) $preview.value = (API_BASE || '');

  // 语言切换通知（可选）
  window.addEventListener('langchange', () => {
    document.getElementById('appTitle').textContent = T('app_title');
  });
})();
