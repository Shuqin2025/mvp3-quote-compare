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
      placeholder: "在此粘贴目录型页面链接（例如某一类目的商品列表页）",
      btn_fetch: "抓取目录",
      btn_export: "导出 Excel（.xlsx）",
      btn_clear: "清空数据",
      page_size: "页量",
      toast_ok: "抓取成功：共 {n} 条（预览前 {m} 条）",
      toast_zero: "暂无数据（预览前 0 条）",
      toast_fail_prefix: "抓取失败：",
      toast_exporting: "正在生成 Excel…",
      link_text: "链接",
      footer_support: "支持的网站",
      footer_privacy: "隐私政策",
      footer_contact: "联系我们",
    },
    de: {
      app_name: "Yunivera DataBridge",
      placeholder:
        "Katalog-/Listen-URL hier einfügen (z. B. eine Produktlisten-Seite)",
      btn_fetch: "Katalog abrufen",
      btn_export: "Excel exportieren (.xlsx)",
      btn_clear: "Daten leeren",
      page_size: "Anzahl / Seite",
      toast_ok: "Erfolg: {n} Einträge (zeige zuerst {m})",
      toast_zero: "Keine Daten (zeige zuerst 0)",
      toast_fail_prefix: "Fehlgeschlagen: ",
      toast_exporting: "Excel wird erstellt…",
      link_text: "Link",
      footer_support: "Unterstützte Websites",
      footer_privacy: "Datenschutz",
      footer_contact: "Kontakt",
    },
    en: {
      app_name: "Yunivera DataBridge",
      placeholder:
        "Paste a catalog/list page URL here (e.g. a category product list)",
      btn_fetch: "Fetch Catalog",
      btn_export: "Export Excel (.xlsx)",
      btn_clear: "Clear",
      page_size: "Page size",
      toast_ok: "Success: {n} items (showing first {m})",
      toast_zero: "No data (showing first 0)",
      toast_fail_prefix: "Fetch failed: ",
      toast_exporting: "Generating Excel…",
      link_text: "link_text",
      footer_support: "Supported Sites",
      footer_privacy: "Privacy",
      footer_contact: "Contact us",
    },
  };

  function t(key, vars) {
    const lang = window.__currentLang || pick();
    let s = (dict[lang] && dict[lang][key]) || dict.en[key] || key;
    if (vars) {
      for (const k in vars) {
        s = s.replace(new RegExp("\\{" + k + "\\}", "g"), String(vars[k]));
      }
    }
    return s;
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
