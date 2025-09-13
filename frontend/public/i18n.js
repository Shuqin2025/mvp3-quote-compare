<script>
window.__DICT__ = {
  zh: {
    title: "云贸星 智能表格生成器",
    subtitle: "输入目录型网页链接，秒生成 Excel 产品表格。",
    lang_cn: "CN 中文",
    lang_de: "DE Deutsch",
    lang_en: "GB English",
    input_placeholder: "在此粘贴目录型页面链接（例如某一类目的商品列表页）",
    btn_fetch: "抓取目录",
    btn_export: "导出 Excel（.xlsx）",
    btn_clear: "清空数据",
    preview_label: "预览（前 {n} 条）",
    toast_success: "抓取成功：共 {n} 条（预览前 {m} 条）",
    toast_zero: "抓取成功：共 0 条（预览前 {m} 条）",
    no_data: "暂无数据",
    footer_support: "支持的网站",
    footer_privacy: "隐私政策",
    footer_contact: "联系我们",
    link_text: "链接"
  },
  en: {
    title: "Yunivera DataBridge",
    subtitle: "Enter a catalog link, instantly generate an Excel product sheet.",
    lang_cn: "CN 中文",
    lang_de: "DE Deutsch",
    lang_en: "GB English",
    input_placeholder: "Paste a catalog page URL here (a product listing page).",
    btn_fetch: "Fetch",
    btn_export: "Export Excel (.xlsx)",
    btn_clear: "Clear Data",
    preview_label: "Preview (first {n})",
    toast_success: "Success: {n} items (showing {m})",
    toast_zero: "Success: 0 items (showing {m})",
    no_data: "No data",
    footer_support: "Supported Sites",
    footer_privacy: "Privacy Policy",
    footer_contact: "Contact Us",
    link_text: "Link"
  },
  de: {
    title: "Yunivera DataBridge",
    subtitle: "Katalog-Link eingeben, sofort Excel-Produktliste erstellen.",
    lang_cn: "CN 中文",
    lang_de: "DE Deutsch",
    lang_en: "GB English",
    input_placeholder: "Fügen Sie hier eine Katalog-URL ein (Produktlisten-Seite).",
    btn_fetch: "Katalog abrufen",
    btn_export: "Excel exportieren (.xlsx)",
    btn_clear: "Daten leeren",
    preview_label: "Vorschau (erste {n})",
    toast_success: "Erfolg: {n} Einträge (zeige {m})",
    toast_zero: "Erfolg: 0 Einträge (zeige {m})",
    no_data: "Keine Daten",
    footer_support: "Unterstützte Websites",
    footer_privacy: "Datenschutz",
    footer_contact: "Kontakt",
    link_text: "Link"
  }
};

// 简易 i18n
window.i18n = (function () {
  function getLang() {
    const urlLang = new URL(location.href).searchParams.get("lang");
    if (urlLang) localStorage.setItem("lang", urlLang);
    return localStorage.getItem("lang") || "zh";
  }
  function t(key, vars = {}) {
    const lang = getLang();
    let s = (window.__DICT__?.[lang]?.[key]) || key;
    Object.entries(vars).forEach(([k, v]) => {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    });
    return s;
  }
  function apply() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => {
      const key = el.getAttribute("data-i18n-ph");
      el.setAttribute("placeholder", t(key));
    });
  }
  function set(lang) {
    localStorage.setItem("lang", lang);
    apply();
  }
  return { t, apply, set, get: getLang };
})();
</script>
