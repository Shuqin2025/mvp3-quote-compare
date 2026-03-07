/** 
 * export-xlsx.js
 * Excel Catalog Schema v1.1 (English demo default)
 *
 * Priority:
 * 1) Call backend business export:
 *      POST /v1/api/export/xlsx?lang=en
 * 2) Fallback to local SpreadsheetML export if gateway/backend export fails
 *
 * Global API:
 *   window.ExportXlsx.export(items, filename, apiBase, options)
 *
 * items: [{ sku, img, title, price, url, moq }]
 * filename: "excel_catalog_en_demo.xlsx"
 * apiBase: optional, e.g. "https://yunivera-gateway.onrender.com"
 * options:
 *   - lang: "en" (default)
 *   - withImages: true (default)
 */

(function () {
  const XML_HEADER =
    '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';

  const WORKBOOK_OPEN =
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
    'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:html="http://www.w3.org/TR/REC-html40">';

  const WORKBOOK_CLOSE = "</Workbook>";

  const STYLES = `
    <Styles>
      <Style ss:ID="sHeader">
        <Font ss:Bold="1"/>
        <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
        <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
      </Style>
      <Style ss:ID="sText">
        <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      </Style>
      <Style ss:ID="sURL">
        <Font ss:Color="#1155CC" ss:Underline="Single"/>
      </Style>
      <Style ss:ID="sMoney">
        <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      </Style>
      <Style ss:ID="sCenter">
        <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      </Style>
    </Styles>`;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function resolveApiBase(apiBase) {
    if (apiBase && String(apiBase).trim()) {
      return String(apiBase).trim().replace(/\/+$/, "");
    }

    try {
      const qs = new URLSearchParams(window.location.search);
      const fromQuery = qs.get("api");
      if (fromQuery && String(fromQuery).trim()) {
        return String(fromQuery).trim().replace(/\/+$/, "");
      }
    } catch (e) {}

    if (window.__API_BASE__ && String(window.__API_BASE__).trim()) {
      return String(window.__API_BASE__).trim().replace(/\/+$/, "");
    }

    if (window.API_BASE && String(window.API_BASE).trim()) {
      return String(window.API_BASE).trim().replace(/\/+$/, "");
    }

    return "";
  }

  function normalizeItems(input) {
    const arr = Array.isArray(input) ? input : [];
    return arr.map((r, idx) => {
      const itemNo =
        r?.sku ??
        r?.itemNo ??
        r?.item_no ??
        r?.code ??
        r?.id ??
        "";

      const description =
        r?.title ??
        r?.description ??
        r?.name ??
        r?.productName ??
        "";

      const picture =
        r?.img ??
        r?.image ??
        r?.imageUrl ??
        r?.picture ??
        "";

      const moq =
        r?.moq ??
        r?.minQty ??
        r?.minimumOrderQuantity ??
        r?.qty ??
        "";

      const unitPrice =
        r?.unitPrice ??
        r?.price ??
        r?.amount ??
        "";

      const link =
        r?.url ??
        r?.productUrl ??
        r?.link ??
        r?.href ??
        "";

      return {
        index: idx + 1,
        itemNo,
        picture,
        description,
        moq,
        unitPrice,
        link,

        // keep legacy aliases for backend compatibility
        sku: itemNo,
        img: picture,
        title: description,
        price: unitPrice,
        url: link,
      };
    });
  }

  function extractFilename(contentDisposition, fallback) {
    if (!contentDisposition) return fallback;

    const m1 = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (m1 && m1[1]) {
      try {
        return decodeURIComponent(m1[1]).replace(/[/\\:*?"<>|]/g, "_");
      } catch (e) {}
    }

    const m2 = /filename="?([^"]+)"?/i.exec(contentDisposition);
    if (m2 && m2[1]) {
      return m2[1].replace(/[/\\:*?"<>|]/g, "_");
    }

    return fallback;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "excel_catalog_en_demo.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function buildWorksheetXML(name, rows) {
    const cols = [
      { title: "#", width: 42 },
      { title: "Item No.", width: 120 },
      { title: "Picture", width: 300 },
      { title: "Description", width: 480 },
      { title: "MOQ", width: 90 },
      { title: "Unit Price", width: 110 },
      { title: "Link", width: 260 },
    ];

    const colsXml =
      "<Table>" +
      cols
        .map((c) => `<Column ss:AutoFitWidth="0" ss:Width="${c.width}"/>`)
        .join("") +
      `<Row ss:AutoFitHeight="0">` +
      cols
        .map(
          (c) =>
            `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${esc(
              c.title
            )}</Data></Cell>`
        )
        .join("") +
      `</Row>`;

    const rowsXml = rows
      .map((r, i) => {
        const cells = [
          `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${i + 1}</Data></Cell>`,
          `<Cell ss:StyleID="sText"><Data ss:Type="String">${esc(
            r.itemNo || ""
          )}</Data></Cell>`,
          `<Cell ss:StyleID="sText"><Data ss:Type="String">${esc(
            r.picture || ""
          )}</Data></Cell>`,
          `<Cell ss:StyleID="sText"><Data ss:Type="String">${esc(
            r.description || ""
          )}</Data></Cell>`,
          `<Cell ss:StyleID="sCenter"><Data ss:Type="String">${esc(
            r.moq || ""
          )}</Data></Cell>`,
          `<Cell ss:StyleID="sMoney"><Data ss:Type="String">${esc(
            r.unitPrice || ""
          )}</Data></Cell>`,
          r.link
            ? `<Cell ss:StyleID="sURL"><Data ss:Type="String">${esc(
                r.link
              )}</Data></Cell>`
            : `<Cell ss:StyleID="sText"><Data ss:Type="String"></Data></Cell>`,
        ];

        return `<Row>${cells.join("")}</Row>`;
      })
      .join("");

    return `
      <Worksheet ss:Name="${esc(name)}">
        ${colsXml}
        ${rowsXml}
      </Table>
      </Worksheet>
    `;
  }

  function buildWorkbook(name, rows) {
    return (
      XML_HEADER +
      WORKBOOK_OPEN +
      STYLES +
      buildWorksheetXML(name, rows) +
      WORKBOOK_CLOSE
    );
  }

  async function exportLocal(items, filename) {
    const normalized = normalizeItems(items);
    const xml = buildWorkbook("Catalog", normalized);
    const blob = new Blob([xml], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    downloadBlob(blob, filename || "excel_catalog_en_demo.xlsx");
  }

  async function tryGatewayExport(apiBase, items, filename, options = {}) {
    const base = resolveApiBase(apiBase);
    if (!base) return false;

    const lang = String(options.lang || "en").toLowerCase();
    const normalized = normalizeItems(items);

    const url = `${base}/v1/api/export/xlsx?lang=${encodeURIComponent(lang)}`;

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Lang": lang,
        },
        body: JSON.stringify({
          items: normalized,
          filename: String(filename || "excel_catalog_en_demo").replace(
            /\.xlsx$/i,
            ""
          ),
          withImages: options.withImages !== false,
          schemaVersion: "excel_catalog_schema_v1.1",
        }),
        mode: "cors",
      });

      if (!resp.ok) {
        console.warn("[export-xlsx] business export failed:", resp.status);
        return false;
      }

      const blob = await resp.blob();
      const finalName = extractFilename(
        resp.headers.get("content-disposition"),
        filename || "excel_catalog_en_demo.xlsx"
      );
      downloadBlob(blob, finalName);
      return true;
    } catch (err) {
      console.warn("[export-xlsx] gateway export exception:", err);
      return false;
    }
  }

  async function exportXlsx(items, filename, apiBase, options = {}) {
    const ok = await tryGatewayExport(apiBase, items, filename, options);
    if (ok) return;

    console.warn("[export-xlsx] fallback to local export");
    await exportLocal(items, filename);
  }

  window.ExportXlsx = {
    export: exportXlsx,
    normalizeItems,
  };
})();
