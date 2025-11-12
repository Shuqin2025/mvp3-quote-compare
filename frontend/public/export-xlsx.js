/* eslint-disable no-console */
// frontend/public/export-xlsx.js
// 统一导出 Excel（.xlsx）模块。
// 重点修复：网关地址与路径、POST 方法、图片代理、健壮性与回退逻辑。
// -------------------------------------------------------------

/** 读取 URL 查询参数里的 api 基址（index.html 采用 ?api=xxx 透传） */
function detectApiBaseFromSearch() {
  const q = new URLSearchParams(window.location.search);
  const raw = q.get("api");
  return raw ? String(raw).trim() : "";
}

/** 统一拿到 apiBase：UI_ENHANCE 可注入；否则走 ?api= */
function getApiBase() {
  const injected =
    (window.UI_ENHANCE && window.UI_ENHANCE.apiBase) ||
    detectApiBaseFromSearch();

  return (injected || "").replace(/\/+$/, ""); // 去尾 /
}

/** 拼接网关绝对路径 */
function apiJoin(path) {
  const base = getApiBase();
  if (!base) return path; // 没有的话退回相对路径（本地开发用）
  return base + path;
}

/** 延时工具 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 简单下载 blob 为文件 */
function saveBlob(blob, filename = "export.xlsx") {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** 从表格/数据记录中尽可能拿到「真实图片地址」 */
function resolveImageUrl(maybe) {
  if (!maybe) return "";
  // 已经是 http(s)
  if (/^https?:\/\//i.test(maybe)) return maybe;

  // 懒加载占位的 <img data-src="..." /> 传进来
  try {
    if (typeof maybe === "object" && maybe.dataset && maybe.dataset.src) {
      return maybe.dataset.src;
    }
  } catch (_) {}

  // 兜底：返回原样字符串
  return String(maybe || "");
}

/** 统一转换成「可直连」或「通过网关代理」的图地址 */
function toProxiedImage(url) {
  const real = resolveImageUrl(url);
  if (!real) return "";

  // 通过网关图片代理（已去掉 /api 前缀，并固定 format=raw）
  const proxied =
    apiJoin("/v1/image") + "?format=raw&url=" + encodeURIComponent(real);
  return proxied;
}

/**
 * 把 UI 里的一条产品对象「收敛」成用于导出的扁平结构：
 * - sku / title / img / desc / moq / price / url
 */
function normalizeRow(row) {
  if (!row || typeof row !== "object") return {};

  const sku =
    row.sku ||
    row.SKU ||
    row.id ||
    row.code ||
    ""; // 多种兜底，以免网站差异
  const title = row.title || row.name || row.desc || "";
  const url = row.url || row.link || row.href || "";
  const imgRaw = row.img || row.image || row.thumbnail || "";
  const desc = row.desc || row.description || "";
  const moq = row.moq || row.min || "";
  const price = row.price || row.unit_price || row.priceText || "";

  const img = toProxiedImage(imgRaw);

  return { sku, title, img, desc, moq, price, url };
}

/**
 * 组装导出 payload：
 *  - url: 源目录页
 *  - limit: 数量上限
 *  - items: 扁平化后的行
 */
function buildExportPayload({ sourceUrl = "", limit = 0, rows = [] }) {
  const items = rows.map(normalizeRow).filter((x) => x && (x.sku || x.title));

  return {
    url: sourceUrl,
    limit: Number(limit) || items.length || 0,
    items,
  };
}

/**
 * 调用网关导出接口
 * 重要：路径为 /v1/export-xlsx，方法为 POST（之前 404 就是因为走了 /v1/api/export-xlsx 或 GET）
 */
async function requestExportXlsx(payload) {
  const endpoint = apiJoin("/v1/export-xlsx"); // <- 关键修正
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    // 注意：某些云厂商对 referrer 有限制，如需可加：referrerPolicy: "no-referrer"
    body: JSON.stringify(payload),
  });

  // 有些网关会以 JSON 回传错误信息
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `导出失败（${res.status} ${res.statusText}）\n` + (text || "").slice(0, 500)
    );
  }
  return await res.blob();
}

/**
 * 主导出流程：
 *  - 从外部传 rows/limit/sourceUrl
 *  - 组装 payload -> POST /v1/export-xlsx -> 下载 blob
 */
export async function exportXlsx({ rows = [], limit = 0, sourceUrl = "" }) {
  try {
    // 轻量防抖：避免重复点击
    if (exportXlsx._busy) return;
    exportXlsx._busy = true;

    // 尝试从地址栏的输入框取 URL（你的 UI 有 #txtUrl）
    if (!sourceUrl) {
      const el = document.querySelector("#txtUrl");
      if (el && el.value) sourceUrl = el.value.trim();
    }

    const payload = buildExportPayload({ sourceUrl, limit, rows });
    if (!payload.items.length) {
      throw new Error("没有可导出的数据（rows 为空或缺少必要字段）。");
    }

    const blob = await requestExportXlsx(payload);
    saveBlob(blob, "export.xlsx");
  } finally {
    exportXlsx._busy = false;
  }
}

/**
 * UI 侧的一键绑定：
 *  - 传入 { getRows, getLimit } 两个函数（由 plus 脚本提供）
 *  - 自动接管 #btnExport 按钮
 *  - 状态提示写到 #okbar / #status
 */
export function setupExport({ getRows, getLimit, getSourceUrl } = {}) {
  const btn = document.querySelector("#btnExport");
  if (!btn) {
    console.warn("[export-xlsx] 没有找到 #btnExport，跳过绑定。");
    return;
  }

  const okBar = document.querySelector("#okbar");
  const status = document.querySelector("#status");

  const setInfo = (msg) => {
    if (status) status.textContent = msg || "";
    if (okBar) {
      okBar.style.display = msg ? "" : "none";
      okBar.textContent = msg || "";
    }
  };

  btn.addEventListener("click", async () => {
    try {
      setInfo("正在导出，请稍候…");
      await sleep(60);

      const rows = (getRows && (await getRows())) || [];
      const limit = (getLimit && (await getLimit())) || rows.length || 0;
      const sourceUrl =
        (getSourceUrl && (await getSourceUrl())) ||
        (document.querySelector("#txtUrl")?.value || "");

      await exportXlsx({ rows, limit, sourceUrl });
      setInfo("已开始下载 Excel（export.xlsx）");
    } catch (err) {
      console.error(err);
      setInfo("导出失败：" + (err && err.message ? err.message : String(err)));
      alert("导出失败：\n" + (err && err.message ? err.message : String(err)));
    } finally {
      await sleep(500);
      setInfo("");
    }
  });

  console.log(
    "[export-xlsx] 已绑定按钮，网关：",
    getApiBase() || "(未检测到，走相对路径)"
  );
}

/**
 * 兼容：plus 模块如果以默认导入使用
 */
export default {
  setupExport,
  exportXlsx,
  // 也顺带导出下面两个工具，给 plus.js 有需要时复用
  toProxiedImage,
  getApiBase,
};
