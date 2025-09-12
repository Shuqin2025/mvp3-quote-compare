import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";

// 从 ?api= 里读后端基址
const API_BASE = (() => {
  try {
    const u = new URL(location.href);
    const a = u.searchParams.get("api");
    if (a) return a.replace(/\/+$/, "");
  } catch {}
  return ""; // 未传就留空
})();

function App() {
  const [listUrl, setListUrl] = useState("");
  const [limit, setLimit] = useState(50);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log("[mvp3] App loaded. API_BASE =", API_BASE || "(not set)");
  }, []);

  async function fetchCatalog() {
    if (!API_BASE) return alert("缺少 api 参数，例如：?api=https://<你的-mvp2-backend域名>");
    if (!listUrl) return;

    setLoading(true);
    setRows([]);
    try {
      const u = new URL(`${API_BASE}/v1/api/catalog/parse`);
      u.searchParams.set("url", listUrl);
      u.searchParams.set("limit", String(limit));
      const r = await fetch(u, { mode: "cors" });
      const data = await r.json();
      // 后端保证 items 一定是数组
      setRows(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error("[mvp3] fetch error:", err);
      alert("抓取失败：响应格式不正确，items 不是数组。");
    } finally {
      setLoading(false);
    }
  }

  async function exportExcel() {
    if (!rows.length) return;

    const wb = new window.ExcelJS.Workbook();
    const ws = wb.addWorksheet("catalog");

    // 表头
    const cols = [
      { header: "Item No.", key: "sku", width: 20 },
      { header: "Picture", key: "picture", width: 18 },
      { header: "Description", key: "title", width: 60 },
      { header: "MOQ", key: "moq", width: 10 },
      { header: "Unit Price", key: "price", width: 16 },
      { header: "Link", key: "url", width: 80 },
    ];
    ws.columns = cols;

    // 先写入文本数据（图片稍后再插）
    rows.forEach((it) => {
      ws.addRow({
        sku: it.sku || "",
        title: it.title || "",
        moq: it.moq || "",
        price: (it.price ? it.price : "") + (it.currency ? it.currency : ""),
        url: it.url || "",
      });
    });

    // 把链接做成超链接
    for (let r = 2; r < 2 + rows.length; r++) {
      const cell = ws.getCell(r, 6); // F列 Link
      const url = rows[r - 2].url;
      if (url) {
        cell.value = { text: "链接", hyperlink: url };
        cell.font = { color: { argb: "FF0563C1" }, underline: true };
      }
    }

    // 插入图片（通过后端代理获取，避免跨域/防盗链）
    // 图片尺寸：缩略 90x90 左右比较稳妥
    for (let i = 0; i < rows.length; i++) {
      const imgUrl = rows[i].img;
      if (!imgUrl) continue;

      try {
        const proxy = new URL(`${API_BASE}/v1/api/proxy-img`);
        proxy.searchParams.set("url", imgUrl);

        const buf = await (await fetch(proxy.toString())).arrayBuffer();
        const bytes = new Uint8Array(buf);
        const b64 = btoa(String.fromCharCode(...bytes));

        const imageId = wb.addImage({
          base64: `data:image/jpeg;base64,${b64}`,
          extension: "jpeg",
        });

        // 图片放到第 i+2 行，第 2 列（B列）
        const rowIndex = i + 2;
        const colIndex = 2;

        // 给单元格留点空间
        ws.getRow(rowIndex).height = 70;
        ws.addImage(imageId, {
          tl: { col: colIndex - 1 + 0.1, row: rowIndex - 1 + 0.1 },
          ext: { width: 90, height: 90 },
          editAs: "oneCell",
        });
      } catch (e) {
        // 某张图失败就跳过
        console.warn("image embed failed:", rows[i].img, e);
      }
    }

    // 下载
    const blob = await wb.xlsx.writeBuffer();
    const a = document.createElement("a");
    a.download = `catalog-preview-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"")}.xlsx`;
    a.href = URL.createObjectURL(new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    a.click();
  }

  return (
    <div>
      <div className="note">
        这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。
      </div>

      <div style={{ margin: "10px 0", color: "#a66" }}>
        抓取成功：共 {rows.length} 条（预览前 {limit} 条）
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <input
          style={{ flex: 1 }}
          value={listUrl}
          onChange={(e) => setListUrl(e.target.value.trim())}
          placeholder="粘贴要抓取的目录页 URL（例如某电商分类页）"
        />
        <button disabled={loading} onClick={fetchCatalog}>
          {loading ? "抓取中…" : "抓取目录"}
        </button>
        <select value={limit} onChange={(e) => setLimit(+e.target.value)}>
          {[50, 100, 200].map((n) => (
            <option key={n} value={n}>
              预览（前 {n} 条）
            </option>
          ))}
        </select>
        <button onClick={exportExcel}>导出 Excel（.xlsx）</button>
      </div>

      <div style={{ marginTop: 12, border: "1px dashed #ddd", minHeight: 280, padding: 12, background: "repeating-linear-gradient(45deg,#fafafa,#fafafa 10px,#f5f5f5 10px,#f5f5f5 20px)" }}>
        {/* 简单预览 */}
        {rows.length === 0 ? (
          <div style={{ color: "#888" }}>（占位区域：后续将展示抓取返回的 JSON 简要预览，或转换成表格的展示。）</div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse", background:"#fff" }}>
            <thead>
              <tr>
                <th style={{ textAlign:"left", borderBottom:"1px solid #eee" }}>Item No.</th>
                <th style={{ textAlign:"left", borderBottom:"1px solid #eee" }}>Picture</th>
                <th style={{ textAlign:"left", borderBottom:"1px solid #eee" }}>Description</th>
                <th style={{ textAlign:"left", borderBottom:"1px solid #eee" }}>MOQ</th>
                <th style={{ textAlign:"left", borderBottom:"1px solid #eee" }}>Unit Price</th>
                <th style={{ textAlign:"left", borderBottom:"1px solid #eee" }}>Link</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((it, idx) => (
                <tr key={idx}>
                  <td>{it.sku || ""}</td>
                  <td>
                    {it.img ? <img src={`${API_BASE}/v1/api/proxy-img?url=${encodeURIComponent(it.img)}`} alt="" style={{ width:56, height:56, objectFit:"contain" }} /> : ""}
                  </td>
                  <td>{it.title || ""}</td>
                  <td>{it.moq || ""}</td>
                  <td>{(it.price || "") + (it.currency || "")}</td>
                  <td>{it.url ? <a href={it.url} target="_blank" rel="noreferrer">链接</a> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
