// frontend/src/App.jsx
import React, { useMemo, useState } from "react";

// 读取 ?api=xxx 指定后端
function useApiBase() {
  const u = new URL(location.href);
  const api = u.searchParams.get("api");
  return api || ""; // 若留空，会提示未配置
}

export default function App() {
  const API_BASE = useApiBase();
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  async function fetchList() {
    const url = document.getElementById("url").value.trim();
    const limit = document.getElementById("limit").value || "50";

    if (!API_BASE) {
      alert("未检测到后端地址：请用带 ?api=<你的后端地址> 的预览链接打开此页。");
      return;
    }
    if (!url) {
      alert("请粘贴目录页 URL");
      return;
    }

    setBusy(true);
    try {
      const q = new URL(`${API_BASE}/v1/api/catalog/parse`);
      q.searchParams.set("url", url);
      q.searchParams.set("limit", limit);

      console.log("[mvp3] fetch ->", q.href);

      const r = await fetch(q.href, { mode: "cors" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();

      if (!Array.isArray(data.items)) {
        console.error("[mvp3] fetch error: items 不是数组", data);
        alert("抓取失败：响应格式不正确，items 不是数组。");
        setRows([]);
        setCount(0);
        return;
      }

      setRows(data.items);
      setCount(data.items.length);
      document.getElementById("stat").innerText =
        `抓取成功：共 ${data.items.length} 条（预览前 ${limit} 条）`;
    } catch (e) {
      console.error("[mvp3] fetch error:", e);
      alert("抓取失败：网络或站点限制。");
      setRows([]);
      setCount(0);
    } finally {
      setBusy(false);
    }
  }

  function exportXlsx() {
    // 固定列顺序：Item No. | Picture | Description | MOQ | Unit Price | Link
    const sheetData = [
      ["Item No.", "Picture", "Description", "MOQ", "Unit Price", "Link"],
      ...rows.map((x) => [
        x.sku || "",
        // 说明：社区版 SheetJS 不支持真正内嵌图片，这里保留图片 URL。
        // 如果一定要“内嵌位图”，需要在后端用 exceljs 生成（可后续加 /v1/api/export）。
        x.img || "",
        x.title || "",
        x.moq || "",
        x.price ? `${x.price}${x.currency || ""}` : "",
        x.url || "",
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, "catalog");
    XLSX.writeFile(wb, `catalog-preview-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  return (
    <div>
      <div style={{ display: "none" }} id="apiBase">{API_BASE}</div>

      <div style={{ marginTop: 12 }}>
        <input
          id="url"
          style={{ width: "60%" }}
          placeholder="https://www.s-impuls-shop.de/catalog/home-cinema/audio-kabel"
        />
        <button id="btnFetch" className="btn btn-primary" onClick={fetchList} disabled={busy}>
          {busy ? "抓取中…" : "抓取目录"}
        </button>
        <select id="limit" defaultValue="50">
          <option value="50">预览（前 50 条）</option>
          <option value="100">预览（前 100 条）</option>
        </select>
        <button id="btnXlsx" className="btn" onClick={exportXlsx} disabled={!rows.length}>
          导出 Excel（.xlsx）
        </button>
      </div>

      <table id="tbl" style={{ marginTop: 12, width: "100%" }}>
        <thead>
          <tr>
            <th style={{ width: 140 }}>Item No.</th>
            <th style={{ width: 120 }}>Picture</th>
            <th>Description</th>
            <th style={{ width: 90 }}>MOQ</th>
            <th style={{ width: 120 }}>Unit Price</th>
            <th style={{ width: 80 }}>Link</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x, i) => (
            <tr key={i}>
              <td>{x.sku || ""}</td>
              <td>
                {x.img ? (
                  <img
                    src={x.img}
                    alt=""
                    style={{ width: 90, height: 60, objectFit: "contain" }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  ""
                )}
              </td>
              <td>{x.title || ""}</td>
              <td>{x.moq || "—"}</td>
              <td>{x.price ? `${x.price}${x.currency || ""}` : "—"}</td>
              <td>
                {x.url ? (
                  <a className="link" href={x.url} target="_blank" rel="noreferrer">
                    链接
                  </a>
                ) : (
                  ""
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
