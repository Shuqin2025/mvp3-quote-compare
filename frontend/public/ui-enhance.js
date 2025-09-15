/* ui-enhance v3.7 — fix Excel image embedding (no Buffer), use backend base64 & fallback proxy */

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const elUrl = $("#input-url");
  const elFetch = $("#btn-fetch");
  const elLimit = $("#sel-limit");
  const elXlsx = $("#btn-xlsx");
  const elClear = $("#btn-clear");
  const elStat = $("#stat");
  const tbl = $("#tbl");
  const tbody = $("#tbody");
  const empty = $("#empty");

  // 通过 ?api=... 指定后端；否则默认同域根（便于本地）
  const apiBase = new URLSearchParams(location.search).get("api")?.replace(/\/+$/, "") || "";

  let products = [];  // 当前数据

  function langFromHeader(rsp) {
    try { return rsp.headers.get("X-Lang") || "de"; } catch { return "de"; }
  }

  function setStat(text) {
    elStat.textContent = text;
  }

  function setBusy(b) {
    elFetch.disabled = b;
    elXlsx.disabled = b || products.length === 0;
  }

  function ensureApi() {
    if (!apiBase) {
      alert("请通过 ?api= 后端地址 访问此页，例如：/?api=https://<你的后端域名>");
      throw new Error("missing api base");
    }
  }

  async function fetchJson(url) {
    const rsp = await fetch(url, { credentials: "omit" });
    if (!rsp.ok) throw new Error(`HTTP ${rsp.status}`);
    const lang = langFromHeader(rsp);
    const data = await rsp.json();
    return { data, lang };
  }

  // 解析 & 预览
  async function doFetch() {
    try {
      ensureApi();
      setBusy(true);

      const listUrl = (elUrl.value || "").trim();
      const limit = parseInt(elLimit.value, 10) || 50;

      if (!listUrl) {
        alert("请输入目录页 URL");
        return;
      }

      // 让后端直接把前 limit 张图片转成 base64 返回（字段：img_b64）
      const url =
        `${apiBase}/v1/api/catalog/parse` +
        `?url=${encodeURIComponent(listUrl)}` +
        `&limit=${limit}` +
        `&enrich=true` +
        `&img=base64&imgCount=${limit}`;

      const { data } = await fetchJson(url);
      if (!data || !data.ok) throw new Error(data?.error || "解析失败");

      products = Array.isArray(data.items) ? data.items : (data.products || []);
      const total = data.count || products.length || 0;

      setStat(`抓取成功：共 ${total} 条（预览前 ${Math.min(total, 50)} 条）`);
      renderTable(products.slice(0, Math.min(products.length, 50)));
    } catch (e) {
      console.error("[mvp3] fetch error:", e);
      alert(`抓取失败：${e.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  function renderTable(list) {
    if (!list || list.length === 0) {
      tbl.style.display = "none";
      empty.style.display = "";
      empty.textContent = "ui.no_data";
      return;
    }
    empty.style.display = "none";
    tbl.style.display = "";

    tbody.innerHTML = "";
    list.forEach((it, i) => {
      const tr = document.createElement("tr");

      const tdNo = document.createElement("td");
      tdNo.textContent = String(i + 1);
      tr.appendChild(tdNo);

      const tdPic = document.createElement("td");
      const img = document.createElement("img");
      img.className = "thumb";
      // 列表中为避免跨域，走后端图片代理（不是 base64）
      if (it.img) {
        const proxied = `${apiBase}/v1/api/image?url=${encodeURIComponent(it.img)}`;
        img.src = proxied;
      }
      tdPic.appendChild(img);
      tr.appendChild(tdPic);

      const tdTitle = document.createElement("td");
      tdTitle.textContent = it.title || "";
      tr.appendChild(tdTitle);

      const tdMoq = document.createElement("td");
      tdMoq.textContent = it.moq || "—";
      tr.appendChild(tdMoq);

      const tdPrice = document.createElement("td");
      tdPrice.textContent = it.price || "—";
      tr.appendChild(tdPrice);

      const tdLink = document.createElement("td");
      if (it.url) {
        const a = document.createElement("a");
        a.href = it.url; a.target = "_blank"; a.rel = "noreferrer";
        a.textContent = "链接";
        tdLink.appendChild(a);
      } else {
        tdLink.textContent = "—";
      }
      tr.appendChild(tdLink);

      tbody.appendChild(tr);
    });
  }

  // small helper: 解析 dataURL 的扩展名（缺省 jpeg）
  function extFromDataUrl(dataUrl) {
    const m = /^data:(image\/[a-z0-9.+-]+);base64,/i.exec(dataUrl || "");
    if (!m) return "jpeg";
    const mime = m[1].toLowerCase();
    if (mime.includes("png")) return "png";
    if (mime.includes("gif")) return "gif";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("bmp")) return "bmp";
    if (mime.includes("svg")) return "svg";
    return "jpeg";
  }

  // fallback：如果列表里没有 img_b64，就临时向后端要一份 base64
  async function ensureBase64(it) {
    if (it.img_b64) return it.img_b64;
    if (!it.img) return "";

    try {
      const url = `${apiBase}/v1/api/image64?url=${encodeURIComponent(it.img)}`;
      const { data } = await fetchJson(url);
      if (data && data.ok && data.base64) {
        it.img_b64 = data.base64;
        return data.base64;
      }
    } catch (e) {
      console.warn("[img64] convert failed:", it.img, e);
    }
    return "";
  }

  // 导出 Excel（带内嵌图片）
  async function exportXlsx() {
    try {
      if (!products || products.length === 0) {
        alert("没有可导出的数据");
        return;
      }
      setBusy(true);

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("catalog");

      // 列
      ws.columns = [
        { header: "#", key: "idx", width: 6 },
        { header: "Picture", key: "pic", width: 14 },
        { header: "Description", key: "title", width: 60 },
        { header: "MOQ", key: "moq", width: 12 },
        { header: "Unit Price", key: "price", width: 16 },
        { header: "Link", key: "link", width: 12 },
      ];

      // 行数据
      products.forEach((it, i) => {
        ws.addRow({
          idx: i + 1,
          pic: "", // 图片稍后插入
          title: it.title || "",
          moq: it.moq || "",
          price: it.price || "",
          link: "链接",
        });
      });

      // 给“链接”列加超链接
      products.forEach((it, i) => {
        const cell = ws.getCell(i + 2, 6); // 第 2 行开始，第 6 列
        if (it.url) {
          cell.value = { text: "链接", hyperlink: it.url, tooltip: it.url };
          cell.font = { color: { argb: "FF1D4ED8" }, underline: true };
        } else {
          cell.value = "";
        }
      });

      // 行高为图片预留空间
      for (let r = 2; r <= products.length + 1; r++) {
        ws.getRow(r).height = 52;
      }

      // 逐条插入图片（异步并发控制）
      const concurrency = 6;
      let idx = 0;
      async function worker() {
        while (idx < products.length) {
          const i = idx++;
          const it = products[i];
          const base64 = await ensureBase64(it);
          if (!base64) continue;

          const ext = extFromDataUrl(base64);
          const imgId = wb.addImage({ base64, extension: ext });

          // 放在第 i+2 行、第 2 列（B）的位置；约 46x46 px
          ws.addImage(imgId, {
            tl: { col: 1 + 0.15, row: i + 1 + 0.2 }, // B 列偏移一点
            ext: { width: 46, height: 46 },
            editAs: "oneCell",
          });
        }
      }
      await Promise.all(Array.from({ length: concurrency }, worker));

      // 导出
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const name = `catalog-${Date.now()}.xlsx`;
      saveAs(blob, name);
    } catch (e) {
      console.error("[xlsx] export error:", e);
      alert(`导出失败：${e.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  function clearAll() {
    products = [];
    tbody.innerHTML = "";
    tbl.style.display = "none";
    empty.style.display = "";
    empty.textContent = "ui.no_data";
    setStat("抓取成功：共 0 条（预览前 50 条）");
  }

  // 事件
  elFetch.addEventListener("click", doFetch);
  elXlsx.addEventListener("click", exportXlsx);
  elClear.addEventListener("click", clearAll);

  // 初始可用态
  setBusy(false);
})();
