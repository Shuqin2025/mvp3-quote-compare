// public/i18n.js
// ==============================
// Yunivera DataBridge 多语言字典骨架（简化版）
// 说明：保留页面必需词条，保证首屏渲染和按钮可点击
// ==============================
(function () {
  // 支持的语言列表（按优先顺序）
  const LANGS = ["zh", "de", "en"];

  // 从 localStorage 读取语言，若无则默认德语
  function pick() {
    const saved = (localStorage.getItem("lang") || "").toLowerCase();
    return LANGS.includes(saved) ? saved : "de";
  }

  // ========= 词典定义 =========
  // 注意：每个 key 三种语言必须齐全，否则会 fallback 到英文
  const dict = {
    zh: {
      app_name: "云贸星 智能表格生成器",
      subtitle: "输入目录型网页链接，秒生成 Excel 产品表格",
      placeholder: "在此粘贴目录型页面链接",
      btn_fetch: "抓取目录",
      btn_export: "导出 Excel",
      btn_clear: "清空数据",
      footer_support: "支持的网站",
      footer_privacy: "隐私政策",
      footer_contact: "联系我们",
    },
    de: {
      app_name: "Yunivera DataBridge",
      subtitle: "Katalog-Link eingeben, sofort Excel-Produktliste erstellen",
      placeholder: "Katalog- oder Listen-URL hier einfügen",
      btn_fetch: "Katalog abrufen",
      btn_export: "Excel exportieren",
      btn_clear: "Daten leeren",
      footer_support: "Unterstützte Websites",
      footer_privacy: "Datenschutz",
      footer_contact: "Kontakt",
    },
    en: {
      app_name: "Yunivera DataBridge",
      subtitle: "Enter a catalog page link, instantly generate an Excel product sheet",
      placeholder: "Paste catalog/list page URL here",
      btn_fetch: "Fetch Catalog",
      btn_export: "Export Excel",
      btn_clear: "Clear",
      footer_support: "Supported Sites",
      footer_privacy: "Privacy Policy",
      footer_contact: "Contact Us",
    },
  };

  // 翻译函数：安全返回，缺失时 fallback 英文
  function t(key) {
    const lang = window.__currentLang || pick();
    return (dict[lang] && dict[lang][key]) || dict.en[key] || key;
  }

  // 设置语言 & 通知全局刷新
  function set(lang) {
    if (!LANGS.includes(lang)) lang = "de"; // 防止传入非法值
    localStorage.setItem("lang", lang);
    window.__currentLang = lang;
    // 通知页面更新
    window.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
  }

  // 将 i18n 对象挂到全局
  window.i18n = { t, set, pickLang: pick };
  window.__currentLang = pick();
})();

/*
===========================
后续可添加的扩展 key：
---------------------------
toast_zero      : “暂无数据（预览前 {{m}} 条）”
toast_success   : “抓取成功：共 {{n}} 条（预览前 {{m}} 条）”
tip_exporting   : “正在生成 Excel…”
link_text       : “链接”
page_size_label : “预览条数”
===========================
建议：等抓取和导出功能确认正常后，再把这些提示词加回字典，避免首屏报错。
*/
