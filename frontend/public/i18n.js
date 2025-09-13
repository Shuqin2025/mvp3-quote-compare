// public/i18n.js
(function () {
  const LANGS = ["zh", "de", "en"];

  function pick() {
    const s = (localStorage.getItem("lang") || "").toLowerCase();
    return LANGS.includes(s) ? s : "de"; // 默认德语
  }

  const dict = {
    zh: {
      app_name: "云贸星 智能表格生成器",
      subtitle: "输入目录型网页链接，秒生成 Excel 产品表格",
      placeholder: "在此粘贴目录型页面链接",
      btn_fetch: "抓取目录",
      btn_export: "导出 Excel",
      btn_clear: "清空",
      footer_support: "支持的网站",
      footer_privacy: "隐私政策",
      footer_contact: "联系我们",
    },
    de: {
      app_name: "Yunivera DataBridge",
      subtitle: "Fügen Sie eine Katalog-URL ein, um sofort Excel-Tabellen zu generieren",
      placeholder: "Katalog-/Listen-URL hier einfügen",
      btn_fetch: "Katalog abrufen",
      btn_export: "Excel exportieren",
      btn_clear: "Daten leeren",
      footer_support: "Unterstützte Websites",
      footer_privacy: "Datenschutz",
      footer_contact: "Kontakt",
    },
    en: {
      app_name: "Yunivera DataBridge",
      subtitle: "Paste a catalog/list URL to instantly generate Excel table",
      placeholder: "Paste catalog/list page URL here",
      btn_fetch: "Fetch Catalog",
      btn_export: "Export Excel",
      btn_clear: "Clear",
      footer_support: "Supported Sites",
      footer_privacy: "Privacy",
      footer_contact: "Contact us",
    },
  };

  function t(key) {
    const lang = window.__currentLang || pick();
    return (dict[lang] && dict[lang][key]) || dict.en[key] || key;
  }

  function set(lang) {
    if (!LANGS.includes(lang)) lang = "de";
    localStorage.setItem("lang", lang);
    window.__currentLang = lang;
    window.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
  }

  window.i18n = { t, set, pickLang: pick };
  window.__currentLang = pick();
})();
