import React, { useMemo, useRef, useState } from "react";
import axios from "axios";

// ====== 环境中的 API_BASE（和你之前一致） ======
const urlParams = new URLSearchParams(location.search);
const API_BASE = (urlParams.get("api") || "").replace(/\/+$/, "");

/** 从 url 或 img 路径里尽量提取货号（Item No.） */
function pickItemNo({ url, img }) {
  const fromImg = /\/([\w-]+)\.(?:jpg|jpeg|png|webp)$/i.exec(img || "");
  if (fromImg?.[1]) return fromImg[1];

  // 例如 ...-30805-1-5-MHQ-SLIM.html
  const fromUrl = /-([0-9][\w-]*?)\.html?$/i.exec(url || "");
  if (fromUrl?.[1]) return fromUrl[1];

  // 兜底：取路径最后一段
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return (last || "").replace(/\.html?$/i, "");
  } catch {
    return "";
  }
}

/** 下载图片为 base64，用于 ExcelJS addImage */
async function getImageBase64(src) {
  if (!src) return null;
  try {
    const resp = await fetch(src, { mode: "cors" });
    if (!resp.ok) throw new Error(resp.statusText);
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    // 简单按扩展名判断
    const ext = /\.png$/i.test(src) ? "png" : "jpeg";
    return { base64: b64, ext };
  } catch {
    return null; // 跨域或 404 时，回退为仅放链接
  }
}

/** 渲染简表（页面上的“预览”） */
function PreviewTable({ rows }) {
  if (!rows.length) {
    return (
      <div id="resultBox" style={{ display: "flex", alignItems: "center", color: "#999" }}>
        （占位区域：后续将展示抓取返回的 JSON 简要预览，或转换成表格的展示。）
      </div>
    );
  }
  return (
    <div id="resultBox">
      <table>
        <thead>
          <tr>
            <th style={{width:120}}>Item No.</th>
            <th style={{width:120}}>Picture</th>
            <th>Description</th>
            <th style={{width:100}}>MOQ</th>
            <th style={{width:120}}>Unit Price</th>
            <th style={{width:80}}>Link</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx}>
              <td>{r.itemNo || ""}</td>
              <td>
                {r.img ? (
                  <img src={r.img} alt="" style={{ width: 80, height: 80, objectFit: "contain" }} />
                ) : (
                  "—"
                )}
              </td>
              <td>{r.title || ""}</td>
              <td>{r.moq ?? "—"}</td>
              <td>
                {r.price != null && r.currency
                  ? `${r.price}${r.currency}`
                  : "—"}
              </td>
              <td>
                {r.url ? (
                  <a className="link" href={r.url} target="_blank" rel="noreferrer">链接</a>
                ) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [inputUrl, setInputUrl] = useState("");
  const [limit, setLimit] = useState(50);
  const [rows, setRows] = useState([]);
  const busyRef = useRef(false);

  const disabled = useMemo(() => !API_BASE || busyRef.current, []);

  async function handleFetch() {
    if (!API_BASE) {
      alert("未检测到 API_BASE；请用带 ?api= 的预览地址打开。");
      return;
    }
    if (!inputUrl.trim()) {
      alert("请粘贴目录页（分类列表）URL。");
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;

    try {
      const url = `${API_BASE}/v1/api/catalog/parse`;
      const { data } = await axios.get(url, {
        params: { url: inputUrl.trim(), limit },
        headers: { "x-lang": i18n.getLang?.() || "zh" },
      });

      if (!data || !Array.isArray(data.products)) {
        throw new Error("响应格式不正确，items 不是数组。");
      }

      // 统一映射成导出的固定结构
      const mapped = data.products.map((p) => ({
        itemNo: pickItemNo(p),
        img: p.img || "",
        title: p.title || "",
        moq: p.moq ?? "",                          // 后端若补齐这里就显示
        price: p.price ?? null,                    // 后端若补齐这里就显示
        currency: p.currency ?? null,              // 后端若补齐这里就显示
        url: p.url || "",
      }));
      setRows(mapped);
    } catch (err) {
      console.error("[mvp3] fetch error:", err);
      alert(`抓取失败：${err?.message || err}`);
    } finally {
      busyRef.current = false;
    }
  }

  async function handleExportXLSX() {
    if (!rows.length) {
      alert("没有可导出的数据。请先抓取目录。");
      return;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("catalog");

    // 列宽、表头
    ws.columns = [
      { header: "Item No.", key: "itemNo", width: 22 },
      { header: "Picture", key: "picture", width: 18 },
      { header: "Description", key: "title", width: 60 },
      { header: "MOQ", key: "moq", width: 10 },
      { header: "Unit Price", key: "unitPrice", width: 14 },
      { header: "Link", key: "link", width: 80 },
    ];

    // 先插入“文字”行（图片列稍后替换为图片）
    rows.forEach((r) => {
      ws.addRow({
        itemNo: r.itemNo || "",
        picture: r.img || "", // 先占位（若图片跨域失败，这里至少保留图片 URL）
        title: r.title || "",
        moq: r.moq ?? "",
        unitPrice:
          r.price != null && r.currency ? `${r.price}${r.currency}` : "",
        link: r.url || "",
      });
    });

    // 给链接列加超链接样式
    ws.getColumn("link").eachCell((cell, row) => {
      if (row === 1) return; // 表头
      const v = cell.value;
      if (typeof v === "string" && /^https?:\/\//i.test(v)) {
        cell.value = { text: "链接", hyperlink: v };
        cell.font = { color: { argb: "FF1D4ED8" }, underline: true };
      }
    });

    // 插入图片（逐行）
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.img) continue;

      const base64 = await getImageBase64(r.img);
      if (!base64) continue; // 跨域失败则保留图片 URL 字符串

      const imageId = wb.addImage({
        base64: base64.base64,
        extension: base64.ext,
      });

      // 图片放在第 (i+2) 行（因为第1行为表头），第2列（Picture）
      const rowIndex = i + 2;
      ws.mergeCells(rowIndex, 2, rowIndex, 2); // 保持单元格定位
      // 控制大小（大约 80x80）
      ws.addImage(imageId, {
        tl: { col: 1 + 0.15, row: rowIndex - 1 + 0.15 }, // 0-based 坐标
        ext: { width: 80, height: 80 },
        editAs: "oneCell",
      });
    }

    // 下载
    const filename = `catalog-preview-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "")}.xlsx`;
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
  }

  return (
    <div>
      <div className="tip ok" style={{marginBottom:12}}>
        这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。
      </div>

      <div className="tip" style={{marginBottom:12}}>
        抓取成功：共 {rows.length} 条（预览前 {limit} 条）
      </div>

      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
        <input
          value={inputUrl}
          onChange={(e)=>setInputUrl(e.target.value)}
          placeholder="粘贴要抓取的目录页 URL（例如某电商分类页）"
          style={{flex:1}}
        />
        <button className="primary" onClick={handleFetch}>抓取目录</button>

        <select value={limit} onChange={(e)=>setLimit(+e.target.value)}>
          {[50,100,150,200].map(n=>(
            <option key={n} value={n}>预览（前 {n} 条）</option>
          ))}
        </select>

        <button onClick={handleExportXLSX}>导出 Excel（.xlsx）</button>
      </div>

      <PreviewTable rows={rows} />
      <div style={{color:"#999",marginTop:12}}>
        © MVP3 — 页面骨架（占位版）。确认部署稳定后，将逐步接回业务逻辑。
      </div>
    </div>
  );
}
