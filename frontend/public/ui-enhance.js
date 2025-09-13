/* public/ui-enhance.js  ——  最小可用版（POST /v1/api/parse） */

/** 读取 ?api=xxx 基地址；没有则用当前站点 */
function getApiBase() {
  const u = new URL(window.location.href);
  const fromParam = u.searchParams.get('api');
  if (fromParam && /^https?:\/\//i.test(fromParam)) return fromParam.replace(/\/+$/,'');
  // 退化：当前同域（用于本地静态托管时反向代理）
  return '';
}

/** 简单的 Toast */
function toast(msg, type = 'info') {
  // 你页面里已有提示条容器时可替换为现有实现；这里用 alert 兜底
  console[type === 'error' ? 'error' : 'log']('[toast]', msg);
  const bar = document.querySelector('#toast-bar');
  if (bar) {
    bar.className = '';
    bar.classList.add('toast', `toast-${type}`);
    bar.textContent = msg;
    // 3 秒后自动隐藏
    setTimeout(() => { bar.textContent = ''; bar.className = ''; }, 3000);
  } else {
    // 没有容器就用原生提示，避免无声失败
    if (type === 'error') alert(msg);
  }
}

/** 读取 i18n 文案；没有就回退 key */
function t(key) {
  try {
    if (window.i18n && typeof i18n.t === 'function') {
      return i18n.t(key) || key;
    }
  } catch (_) {}
  return key;
}

/** 渲染到表格区域（你原来的渲染逻辑接上即可） */
function render(result) {
  // 这里假设后端返回 { ok:true, items:[...], products:[...] } 之类结构
  // 你已有的渲染函数如果叫 renderTable / renderProducts，请在此处调用即可
  // 示例：仅清空“暂无数据”占位
  const box = document.querySelector('#data-box') || document.querySelector('.table-box') || document.querySelector('.card-body');
  if (box) {
    // 这里交回你自己的绘制函数；暂时清空作为最小可用占位
    box.innerHTML = '';
  }
}

/** 绑定事件（抓取、导出、清空） */
function bindUI() {
  const apiBase = getApiBase();            // e.g. https://yunivera-mvp2-xxxx.onrender.com
  const input   = document.querySelector('#url-input') || document.querySelector('input[type="url"], input[data-role="url"]');
  const btn     = document.querySelector('#btn-fetch') || document.querySelector('button[data-role="fetch"]');
  const sizeSel = document.querySelector('#page-size') || document.querySelector('select[data-role="page-size"]');
  const btnClear= document.querySelector('#btn-clear') || document.querySelector('button[data-role="clear"]');

  if (!input || !btn) return;

  // 清空
  if (btnClear) {
    btnClear.onclick = () => {
      const box = document.querySelector('#data-box') || document.querySelector('.table-box') || document.querySelector('.card-body');
      if (box) box.innerHTML = `<div class="muted">${t('ui.no_data') || 'no_data'}</div>`;
    };
  }

  // 抓取
  btn.onclick = async () => {
    const url = (input.value || '').trim();
    if (!url) {
      toast(t('ui.input_tip') || '请输入或粘贴一个目录/列表页链接', 'warn');
      input.focus();
      return;
    }

    // 简单 URL 校验
    if (!/^https?:\/\//i.test(url)) {
      toast(t('ui.invalid_url') || '链接格式不正确', 'error');
      input.focus();
      return;
    }

    const pageSize = sizeSel ? Number(sizeSel.value || 50) : 50;

    // 目标：POST /v1/api/parse  { url, pageSize }
    const endpoint = `${apiBase}/v1/api/parse`.replace(/\/+$/, '').replace(/^(?=\/)/, '');

    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = t('ui.fetching') || '抓取中...';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, pageSize })
      });

      if (!res.ok) {
        // 把后端返回的纯文本 / html 错误也读出来，方便定位
        const text = await res.text();
        toast(`${t('toast_fail_prefix') || '抓取失败：'} ${res.status} ${text || res.statusText}`, 'error');
        return;
      }

      // 期望 JSON
      const data = await res.json().catch(async () => {
        const txt = await res.text();
        throw new Error(`Invalid JSON: ${txt?.slice(0, 200) || ''}`);
      });

      if (data && (data.ok || Array.isArray(data.items) || Array.isArray(data.products))) {
        render(data);
        toast(t('toast_ok') || '已完成', 'info');
      } else {
        toast(`${t('toast_fail_prefix') || '抓取失败：'} ${JSON.stringify(data).slice(0, 200)}`, 'error');
      }
    } catch (err) {
      console.error(err);
      toast(`${t('toast_fail_prefix') || '抓取失败：'} ${err.message || err}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  };
}

/** 文档就绪后绑定 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindUI);
} else {
  bindUI();
}
