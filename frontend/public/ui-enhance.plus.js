/* eslint-disable */
//
// ui-enhance.plus.js  —  纯前端增强：抓取/渲染/导出/图片代理
//

import {
  getApiBase,
  imageProxy,
  parseCatalogByUrl,
  exportToXlsxByUrl,
  exportToXlsxByItems,
} from './export-xlsx.js';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

/** 简单 i18n（只保留你页面里用得到的） */
const I18N = {
  zh: { ok: 'ok', failed: '抓取失败：', ready: '准备就绪', fetching: n => `抓取成功：共 ${n} 条` },
  de: { ok: 'ok', failed: 'Fehlgeschlagen: ', ready: 'Bereit', fetching: n => `Erfolg: ${n} Einträge` },
  en: { ok: 'ok', failed: 'Failed: ', ready: 'Ready', fetching: n => `Fetched: ${n} items` },
};

function getLang() {
  try {
    return localStorage.getItem('mvp_lang') || 'zh';
  } catch { return 'zh'; }
}

function setStatus(kind, text) {
  const okbar = $('#okbar');
  const status = $('#status');
  if (!okbar || !status) return;
  if (kind === 'ok') {
    okbar.style.display = 'block';
    okbar.textContent = text || I18N[getLang()].ok;
    status.textContent = I18N[getLang()].ready;
  } else {
    okbar.style.display = 'block';
    okbar.textContent = text;
  }
}

/** 渲染一行到表格 */
function appendRow(tbody, idx, item) {
  const tr = document.createElement('tr');
  const td = (...xs) => {
    const el = document.createElement('td');
    xs.forEach(x => {
      if (x instanceof Node) el.appendChild(x);
      else el.textContent = x ?? '';
    });
    return el;
  };

  // 图片
  const imgWrap = document.createElement('div');
  imgWrap.style.width = '90px';
  imgWrap.style.height = '90px';
  imgWrap.style.display = 'flex';
  imgWrap.style.alignItems = 'center';
  imgWrap.style.justifyContent = 'center';

  const pic = document.createElement('img');
  pic.width = 80; pic.height = 80;
  pic.alt = item.title || '';
  pic.referrerPolicy = 'no-referrer';
  pic.crossOrigin = 'anonymous';

  // 代理多路：primary → fallback → raw
  const prox = imageProxy(item.img || '');
  pic.src = prox.primary;
  pic.onerror = () => {
    // 第一次失败，换 fallback
    if (pic.dataset._tried !== '1') {
      pic.dataset._tried = '1';
      pic.src = prox.fallback;
    } else {
      // 还不行直接用原图（某些站图能匿名直连）
      pic.src = prox.raw || '';
    }
  };

  imgWrap.appendChild(pic);

  // “打开”链接
  const openA = document.createElement('a');
  openA.href = item.url || '#';
  openA.target = '_blank';
  openA.rel = 'noopener noreferrer';
  openA.textContent = '打开';

  tr.appendChild(td(String(idx)));
  tr.appendChild(td(item.sku || ''));
  tr.appendChild(td(imgWrap));
  tr.appendChild(td(item.title || item.desc || ''));
  tr.appendChild(td(item.price || ''));
  tr.appendChild(td(openA));
  tbody.appendChild(tr);
}

/** 抓取按钮逻辑 */
async function onFetch() {
  const lang = getLang();
  const url = $('#txtUrl').value.trim();
  const limit = parseInt(($('#txtLimit').value || '50'), 10) || 50;

  const tbody = $('#tbl tbody') || $('#tbl').appendChild(document.createElement('tbody'));
  tbody.innerHTML = '';

  try {
    setStatus('ok', '...');
    const json = await parseCatalogByUrl({ url, limit, lang });

    // 兼容不同后端字段：items / rows / list
    const items =
      json.items || json.rows || json.list || json.data || [];

    items.forEach((it, i) => appendRow(tbody, i + 1, it));

    setStatus('ok', I18N[lang].fetching(items.length));
  } catch (e) {
    setStatus('err', I18N[lang].failed + (e?.message || e));
    console.error(e);
  }
}

/** 导出（优先后端，失败前端 CSV） */
async function onExport() {
  const lang = getLang();
  const url = $('#txtUrl').value.trim();
  const rows = [];
  // 取现有表格数据用于前端兜底
  $$('#tbl tbody tr').forEach((tr, i) => {
    const tds = $$('td', tr);
    rows.push([
      i + 1,
      tds[1]?.textContent?.trim() || '',
      // 第 3 列图片，保留 img.src（如果显示的是代理，就会是代理 URL）
      (tds[2]?.querySelector('img')?.src) || '',
      tds[3]?.textContent?.trim() || '',
      tds[4]?.textContent?.trim() || '',
      tds[5]?.querySelector('a')?.href || '',
    ]);
  });

  try {
    const r = await exportToXlsxByUrl({ url, limit: rows.length || 50, lang }, [['#','sku','img','title','price','url'], ...rows]);
    setStatus('ok', `导出成功（${r.via}）`);
  } catch (e) {
    setStatus('err', I18N[lang].failed + (e?.message || e));
    console.error(e);
  }
}

/** 清空表格 */
function onClear() {
  const tbody = $('#tbl tbody');
  if (tbody) tbody.innerHTML = '';
}

/** 语言切换按钮（保持你原有的 localStorage 键） */
function bindLangSwitch() {
  $('#btnLangZh')?.addEventListener('click', () => localStorage.setItem('mvp_lang','zh'));
  $('#btnLangDe')?.addEventListener('click', () => localStorage.setItem('mvp_lang','de'));
  $('#btnLangEn')?.addEventListener('click', () => localStorage.setItem('mvp_lang','en'));
}

/** 首次初始化 */
function init() {
  // 控件
  $('#btnFetch')?.addEventListener('click', onFetch);
  $('#btnExport')?.addEventListener('click', onExport);
  $('#btnClear')?.addEventListener('click', onClear);
  bindLangSwitch();

  // 首屏状态
  const lang = getLang();
  setStatus('ok', I18N[lang].ready);

  // 控制台提示方便排障
  try {
    console.info('[ui-plus] enabled, apiBase =', getApiBase());
  } catch {}
}

document.addEventListener('DOMContentLoaded', init);
