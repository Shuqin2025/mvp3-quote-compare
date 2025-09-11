import React, { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";

/** 工具：等待 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 读取页面文本并构造可查询的 DOM */
async function fetchDOM(url, timeout = 15000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);
  const res = await fetch(url, { signal: ctrl.signal, credentials: "omit" });
  clearTimeout(tid);
  const html = await res.text();
  const dom = new DOMParser().parseFromString(html, "text/html");
  return { html, dom, status: res.status };
}

/** 站点：auto-schmuck.com（示例）— 列表页抽取 */
function parseAutoSchmuckList(doc) {
  const items = [];
  // 卡片容器很常见的两种写法，择一
  const cards =
    doc.querySelectorAll(".product-list .product-box, .isotope-container .box") ||
    [];
  cards.forEach((card) => {
    const a =
      card.querySelector("a") || card.querySelector(".title a") || { href: "" };
    const title =
      (card.querySelector(".title") || card.querySelector(".product-name"))?.textContent?.trim() ||
      a?.textContent?.trim() ||
      "";
    const url = a?.href || "";

    // 价格：可能在 .price 或包含 EUR 的节点里
    let price =
      card.querySelector(".price")?.textContent ||
      card.querySelector(".product-price")?.textContent ||
      "";
    price = price.replace(/\s+/g, " ").trim();

    // 图片：优先 <img src> ，退而求其次 data-src / srcset
    let img =
      card.querySelector("img")?.getAttribute("src") ||
      card.querySelector("img")?.getAttribute("data-src") ||
      "";
    if (!img) {
      const srcset = card.querySelector("img")?.getAttribute("srcset") || "";
      if (srcset) img = srcset.split(",").map(s => s.trim().split(" ")[0])[0] || "";
    }

    if (title && url) {
      items.push({
        title,
        url,
        img: img || "",
        price,
        sku: "" // 详情页再补
      });
    }
  });
  return items;
}

/** 站点：s-impuls-shop.de（示例）— 列表页抽取 */
function parseSImpulsList(doc) {
  const items = [];
  const cards =
    doc.querySelectorAll(".product-box, .product--box, .product--details") || [];
  cards.forEach((card) => {
    const a = card.querySelector("a") || { href: "" };
    const title =
      (card.querySelector(".product--title") ||
        card.querySelector(".title") ||
        a)?.textContent?.trim() || "";
    const url = a?.href || "";
    let price =
      card.querySelector(".price--default, .price, .product--price")?.textContent || "";
    price = price.replace(/\s+/g, " ").trim();

    let img =
      card.querySelector("img")?.getAttribute("src") ||
      card.querySelector("img")?.getAttribute("data-src") ||
      "";
    if (!img) {
      const srcset = card.querySelector("img")?.getAttribute("srcset") || "";
      if (srcset) img = srcset.split(",").map(s => s.trim().split(" ")[0])[0] || "";
    }

    if (title && url) {
      items.push({ title, url, img: img || "", price, sku: "" });
    }
  });
  return items;
}

/** 通用兜底解析：尽量找 a/img/price */
function parseGenericList(doc) {
  const items = [];
  const cards = doc.querySelectorAll("a, article, li, .card, .product") || [];
  for (const node of cards) {
    // 优先挑“看起来像产品卡”的
    const a = node.tagName === "A" ? node : node.querySelector("a");
    const title =
      node.querySelector("[itemprop=name], .title, .product-title")?.textContent?.trim() ||
      a?.textContent?.trim() || "";
    const url = a?.href || "";
    let img =
      node.querySelector("img")?.getAttribute("src") ||
      node.querySelector("img")?.getAttribute("data-src") ||
      "";
    if (!img) {
      const srcset = node.querySelector("img")?.getAttribute("srcset") || "";
      if (srcset) img = srcset.split(",").map(s => s.trim().split(" ")[0])[0] || "";
    }
    let price =
      node.querySelector("[itemprop=price], .price, .product-price")?.textContent || "";
    price = price.replace(/\s+/g, " ").trim();

    if (title && url) {
      items.push({ title, url, img: img || "", price, sku: "" });
    }
  }
  // 去重 by url
  const map = new Map();
  items.forEach((it) => {
    if (!map.has(it.url)) map.set(it.url, it);
  });
  return [...map.values()].slice(0, 120); // 防炸
}

/** 详情页补齐：SKU / 价格 / 大图（最佳图） */
function enrichFromDetail(doc, base) {
  const text = doc.body?.innerText || "";

  // SKU/编号常见写法
  const skuMatch =
    text.match(/(?:Art\.?-?Nr\.?|Artikelnummer|Artikel-Nr\.?|Item\s*No\.?|SKU)\s*[:：#]?\s*([A-Za-z0-9\-_/\.]+)/i);
  const sku = skuMatch?.[1]?.trim() || base.sku || "";

  // 价格：找 9.99 EUR / 9,99 € / € 9,99 等
  let price = base.price || "";
  if (!price) {
    const priceEl =
      doc.querySelector("[itemprop=price], .price, .product-price, .price--default");
    if (priceEl) price = priceEl.textContent.replace(/\s+/g, " ").trim();
  }
  if (!price) {
    const p = text.match(/(?:€|EUR)\s*[\d\.,]+|[\d\.,]+\s*(?:€|EUR)/);
    price = p?.[0]?.trim() || "";
  }

  // 大图：优先 og:image
  let img =
    doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
    doc.querySelector("img[itemprop=image]")?.getAttribute("src") ||
    doc.querySelector(".product-image img, .image--element img, .gallery img")?.getAttribute("src") ||
    base.img ||
    "";

  return { sku, price, img };
}

/** 根据域名选择解析器 */
function pickListParser(url) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (host.includes("auto-schmuck")) return parseAutoSchmuckList;
    if (host.includes("s-impuls-shop")) return parseSImpulsList;
    return parseGenericList;
  } catch {
    return parseGenericList;
  }
}

/** 下载图片为 ArrayBuffer（用于 ExcelJS 嵌图） */
async function fetchImageBuffer(url, timeout = 15000) {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(url, { signal: ctrl.signal, mode: "cors" });
    clearTimeout(tid);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return buf;
  } catch {
    return null;
  }
}

export default function App() {
  const [apiBase, setApiBase] = useState("");
  const [url, setUrl] = useState("");
  const [rows, setRows] = useState([]); // {title, url, img, price, sku}

  // 读取 ?api= 后端地址（用于后续你要恢复服务端代理时）
  const API_BASE = useMemo(() => {
    try {
      const u = new URL(window.location.href);
      return (u.searchParams.get("api") || "").trim();
    } catch {
      return "";
    }
  }, []);

  useEffect(() => {
    setApiBase(API_BASE);
    // ui-enhance 的小提示
    if (window.uiEnhance?.mount) window.uiEnhance.mount();
    console.log("[mvp3] App loaded. API_BASE =", API_BASE || "(empty, direct fetch)");
  }, [API_BASE]);

  async function handleFetchList() {
    if (!url) return;
    setRows([]);
    try {
      const { dom } = await fetchDOM(url);
      const parse = pickListParser(url);
      const list = parse(dom);

      // 预览只显示前 50（可改）
      setRows(list.slice(0, 50));
      // 顶部提示
      const ok = document.getElementById("tip");
      if (ok) {
        ok.textContent = `抓取成功：共 ${list.length} 条（预览前 50 条）`;
      }
    } catch (e) {
      console.error(e);
      alert("抓取失败，请换个页面试试。");
    }
  }

  /** 并发补齐详情字段 */
  async function fillDetails(list) {
    const tasks = list.map(async (it) => {
      try {
        const { dom } = await fetchDOM(it.url);
        const fill = enrichFromDetail(dom, it);
        return { ...it, ...fill };
      } catch {
        return it;
      }
    });
    const res = await Promise.allSettled(tasks);
    return res.map((r, i) => (r.status === "fulfilled" ? r.value : list[i]));
  }

  /** 导出 XLSX（原生 Excel） */
  async function exportXlsx() {
    if (!rows.length) return alert("请先抓取目录，再导出。");

    // 优先用预览结果，再补齐详情（避免导出空价格/编号/大图）
    let data = [...rows];
    data = await fillDetails(data);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Catalog");

    // 列配置与表头
    ws.properties.defaultRowHeight = 90;
    ws.columns = [
      { header: "Item No.", key: "sku", width: 18 },
      { header: "Picture", key: "picture", width: 28 },
      { header: "Description", key: "title", width: 60 },
      { header: "MOQ", key: "moq", width: 10 },
      { header: "Unit Price", key: "price", width: 18 },
      { header: "Link", key: "url", width: 80 }
    ];

    // 表头加粗
    ws.getRow(1).font = { bold: true };

    // 行写入 + 图片嵌入 / 链接
    for (let i = 0; i < data.length; i++) {
      const it = data[i];
      const rowIndex = i + 2;

      ws.getCell(rowIndex, 1).value = it.sku || "";               // Item No.
      ws.getCell(rowIndex, 3).value = it.title || "";             // Description
      ws.getCell(rowIndex, 4).value = "";                         // MOQ (暂无)
      ws.getCell(rowIndex, 5).value = it.price || "";             // Unit Price
      ws.getCell(rowIndex, 6).value = { text: it.url || "", hyperlink: it.url || "" }; // Link

      // 图片：尽力嵌入，失败则放超链接
      let embedded = false;
      if (it.img) {
        const buf = await fetchImageBuffer(it.img);
        if (buf) {
          try {
            const ext = it.img.split("?")[0].split(".").pop().toLowerCase();
            const kind = ["png", "jpg", "jpeg"].includes(ext) ? (ext === "png" ? "png" : "jpeg") : "jpeg";
            const imgId = wb.addImage({ buffer: buf, extension: kind });
            // Picture 列是第 2 列
            ws.addImage(imgId, {
              tl: { col: 1.1, row: rowIndex - 0.9 },
              br: { col: 2.9, row: rowIndex - 0.1 }
            });
            embedded = true;
          } catch (e) {
            embedded = false;
          }
        }
      }
      if (!embedded && it.img) {
        ws.getCell(rowIndex, 2).value = { text: "image", hyperlink: it.img };
        ws.getCell(rowIndex, 2).font = { color: { argb: "FF1F4E79" }, underline: true };
      }

      // 行高适配
      ws.getRow(rowIndex).height = 90;
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `catalog-preview-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"")}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px" }}>
      <h1 data-i18n="title_app" style={{ margin: "0 0 12px" }}>MVP3 — App</h1>

      <div
        style={{
          background: "#e6ffed",
          border: "1px solid #b7eb8f",
          padding: "12px 16px",
          borderRadius: 6,
          marginBottom: 14,
          color: "#106b21",
        }}
      >
        这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。
      </div>

      <div
        id="tip"
        style={{
          background: "#fff7e6",
          border: "1px solid #ffe58f",
          padding: "10px 14px",
          borderRadius: 6,
          marginBottom: 14,
          color: "#8b5f00",
        }}
      >
        抓取成功：共 0 条（预览前 50 条）
      </div>

      {/* 抓取输入区 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          placeholder="粘贴要抓取的目录页 URL（例如某电商分类页）"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1px solid #d9d9d9",
            borderRadius: 6,
          }}
        />
        <button
          onClick={handleFetchList}
          style={{
            padding: "10px 16px",
            background: "#1677ff",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          抓取目录
        </button>

        {/* 预览条数（只影响下方表格展示） */}
        <select
          onChange={(e) => setRows((r) => r.slice(0, Number(e.target.value)))}
          defaultValue="50"
          style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid #d9d9d9" }}
        >
          <option value="20">预览（前 20 条）</option>
          <option value="50">预览（前 50 条）</option>
          <option value="100">预览（前 100 条）</option>
        </select>

        <button
          onClick={exportXlsx}
          style={{
            padding: "10px 16px",
            background: "#52c41a",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          导出 Excel（.xlsx）
        </button>
      </div>

      {/* 预览表格（极简） */}
      <div
        style={{
          border: "1px dashed #d9d9d9",
          borderRadius: 8,
          padding: 12,
          minHeight: 220,
          background:
            "repeating-linear-gradient(45deg,#fafafa,#fafafa 12px,#f5f5f5 12px,#f5f5f5 24px)",
        }}
      >
        {rows.length > 0 && (
          <table style={{ width: "100%", background: "#fff", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafafa" }}>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #f0f0f0" }}>title</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #f0f0f0" }}>sku</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #f0f0f0" }}>price</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #f0f0f0" }}>url</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #f0f0f0" }}>img</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>{r.title}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>{r.sku || "-"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>{r.price || "-"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                    <a href={r.url} target="_blank" rel="noreferrer">链接</a>
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f0f0f0" }}>
                    {r.img ? <a href={r.img} target="_blank" rel="noreferrer">链接</a> : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 12, color: "#999" }}>
        © MVP3 — 页面骨架（占位版）。确认部署稳定后，将逐步接回业务逻辑。
      </div>
    </div>
  );
}
