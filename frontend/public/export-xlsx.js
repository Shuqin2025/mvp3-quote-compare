/**
 * export-xlsx.js
 * 自给自足的表格导出：
 * 1) 优先调用后端网关 POST /export-xlsx
 * 2) 失败则前端本地生成 Excel 2003 XML (SpreadsheetML)，Excel 可直接打开
 *
 * 对外暴露：window.ExportXlsx.export(rows, filename)
 * rows:  [{ sku, img, title, price, url }]
 * filename: "export.xlsx"
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

  const WORKBOOK_CLOSE = '</Workbook>';

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
        <NumberFormat ss:Format="Standard"/>
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

  function buildWorksheetXML(name, rows) {
    const cols = [
      { title: "#", width: 40 },
      { title: "货号", width: 110 },
      { title: "图片", width: 300 },
      { title: "描述", width: 480 },
      { title: "单价", width: 80 },
      { title: "打开", width: 220 },
    ];

    const COLS_XML =
      "<Table>" +
      cols
        .map(
          (c) =>
            `<Column ss:AutoFitWidth="0" ss:Width="${c.width}"/>`
        )
        .join("") +
      // 表头
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

    const ROWS_XML = rows
      .map((r, i) => {
        const cells = [
          // 序号
          `<Cell ss:StyleID="sCenter"><Data ss:Type="Number">${i + 1}</Data></Cell>`,
          // 货号
          `<Cell ss:StyleID="sText"><Data ss:Type="String">${esc(
            r.sku || ""
          )}</Data></Cell>`,
          // 图片（放 URL 文本，Excel 不内嵌图片）
          `<Cell ss:StyleID="sText"><Data ss:Type="String">${esc(
            r.img || ""
          )}</Data></Cell>`,
          // 描述
          `<Cell ss:StyleID="sText"><Data ss:Type="String">${esc(
            r.title || ""
          )}</Data></Cell>`,
          // 单价（保留文本，避免 CSV 弹导入）
          `<Cell ss:StyleID="sMoney"><Data ss:Type="String">${esc(
            r.price || ""
          )}</Data></Cell>`,
          // 打开（URL）
          r.url
            ? `<Cell ss:StyleID="sURL"><Data ss:Type="String">${esc(
                r.url
              )}</Data></Cell>`
            : `<Cell ss:StyleID="sText"><Data ss:Type="String"></Data></Cell>`,
        ];
        return `<Row>${cells.join("")}</Row>`;
      })
      .join("");

    return `
      <Worksheet ss:Name="${esc(name)}">
        ${COLS_XML}
        ${ROWS_XML}
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

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "export.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function tryGatewayExport(apiBase, rows, filename) {
    if (!apiBase) return false;
    const url = apiBase.replace(/\/+$/, "") + "/export-xlsx";
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
        // 允许跨域失败，外层兜底
        mode: "cors",
      });
      if (!resp.ok) return false;
      const blob = await resp.blob();
      downloadBlob(blob, filename || "export.xlsx");
      return true;
    } catch (e) {
      return false;
    }
  }

  async function exportLocal(rows, filename) {
    const xml = buildWorkbook("Sheet1", rows);
    const blob = new Blob([xml], {
      type:
        "application/vnd.ms-excel;charset=utf-8",
    });
    downloadBlob(blob, filename || "export.xlsx");
  }

  async function exportXlsx(rows, filename, apiBase) {
    // 先尝试网关
    const ok = await tryGatewayExport(apiBase, rows, filename);
    if (ok) return;
    // 失败则本地导出
    await exportLocal(rows, filename);
  }

  window.ExportXlsx = {
    export: exportXlsx,
  };
})();
