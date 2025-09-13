/* public/i18n.js  ——  Minimal i18n helper for Yunivera DataBridge
 * 用法：
 *   1) 在需要多语言的元素上标记：
 *        <h1 data-i18n="app.title"></h1>
 *        <p  data-i18n="app.subtitle"></p>
 *        <input data-i18n="ui.input_placeholder" data-i18n-attr="placeholder">
 *        <button data-i18n="ui.fetch_btn"></button>
 *        <th data-i18n="tbl.idx"></th>  ……
 *        <a data-i18n="footer.support"></a>
 *      若要写入属性（placeholder/title/value 等），用 data-i18n-attr 指定目标属性
 *   2) 语言切换按钮只需调用：i18n.setLang('zh' | 'de' | 'en')
 *   3) 页面加载后会自动 i18n.apply()，并记忆语言到 localStorage
 */
(function (global) {
  // —— 1) 三语字典（可按需继续补充）——
  const DICT = {
    zh: {
      app: {
        title: "云贸星 智能表格生成器",
        subtitle: "输入目录型网页链接，秒生成 Excel 产品表格。"
      },
      ui: {
        input_placeholder: "在此粘贴目录型页面链接（例如某一类目的商品列表页）",
        fetch_btn: "抓取目录",
        export_btn: "导出 Excel（.xlsx）",
        clear_btn: "清空数据",
        page_size: "每页数量",
        empty: "暂无数据",
        toast_fail_prefix: "抓取失败："
      },
      tbl: {
        idx: "#",
        sku: "Item No.",
        pic: "Picture",
        title: "Description",
        moq: "MOQ",
        price: "Unit Price",
        link: "链接"
      },
      footer: {
        support: "支持的网站",
        privacy: "隐私政策",
        contact: "联系我们"
      }
    },
    de: {
      app: {
        title: "Yunivera DataBridge",
        subtitle: "Katalog-/Listen-URL einfügen – Excel-Produktliste in Sekunden."
      },
      ui: {
        input_placeholder: "Katalog-/Listen-URL hier einfügen (z. B. eine Produktlisten-Seite)",
        fetch_btn: "Katalog abrufen",
        export_btn: "Excel exportieren (.xlsx)",
        clear_btn: "Daten leeren",
        page_size: "Anzahl / Seite",
        empty: "Keine Daten",
        toast_fail_prefix: "Fehler: "
      },
      tbl: {
        idx: "#",
        sku: "Artikel-Nr.",
        pic: "Bild",
        title: "Beschreibung",
        moq: "MOQ",
        price: "Einzelpreis",
        link: "Link"
      },
      footer: {
        support: "Unterstützte Websites",
        privacy: "Datenschutz",
        contact: "Kontakt"
      }
    },
    en: {
      app: {
        title: "Yunivera DataBridge",
        subtitle: "Paste a catalog/list URL and generate an Excel product sheet in seconds."
      },
      ui: {
        input_placeholder: "Paste a catalog/list page URL here (e.g., a product listing page)",
        fetch_btn: "Fetch Catalog",
        export_btn: "Export Excel (.xlsx)",
        clear_btn: "Clear Data",
        page_size: "Page size",
        empty: "No data",
        toast_fail_prefix: "Failed: "
      },
      tbl: {
        idx: "#",
        sku: "Item No.",
        pic: "Picture",
        title: "Description",
        moq: "MOQ",
        price: "Unit Price",
        link: "Link"
      },
      footer: {
        support: "Supported Sites",
        privacy: "Privacy Policy",
        contact: "Contact Us"
      }
    }
  };

  // —— 2) 工具函数：取值（支持 a.b.c 点号路径）——
  function get(obj, path) {
    return path.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);
  }

  // —— 3) 语言状态 —— 
  const LS_KEY = "udb_lang";
  function getLang() {
    const saved = localStorage.getItem(LS_KEY);
    if (saved && DICT[saved]) return saved;
    // 简单按浏览器语言兜底
    const n = (navigator.language || "zh").toLowerCase();
    if (n.startsWith("de")) return "de";
    if (n.startsWith("en")) return "en";
    return "zh";
  }
  let current = getLang();

  // —— 4) 翻译函数 —— 
  function t(key) {
    return get(DICT[current], key) ?? key; // 找不到时返回 key 本身，便于排查
  }

  // —— 5) 扫描并应用到 DOM —— 
  function apply() {
    // 文档标题（可选）
    if (document && document.title) {
      document.title = t("app.title");
    }
    // 批量刷新：文本或属性
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const attr = el.getAttribute("data-i18n-attr"); // e.g. 'placeholder' / 'title' / 'value'
      const value = t(key);
      if (value == null) return;
      if (attr) {
        el.setAttribute(attr, value);
      } else if ("placeholder" in el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        // 兼容没写 data-i18n-attr 的输入框：默认写入 placeholder
        el.placeholder = value;
      } else {
        el.textContent = value;
      }
    });
  }

  // —— 6) 切换语言 —— 
  function setLang(lang) {
    if (!DICT[lang]) lang = "zh";
    current = lang;
    localStorage.setItem(LS_KEY, current);
    apply();
  }

  // —— 7) 首次加载自动应用 —— 
  document.addEventListener("DOMContentLoaded", apply);

  // —— 8) 导出到全局 —— 
  global.i18n = {
    t,
    setLang,
    getLang: () => current,
    apply,
    DICT // 方便你后续动态补充词条
  };
})(window);
