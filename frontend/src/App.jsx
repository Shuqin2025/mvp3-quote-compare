import React, { useState, useMemo } from "react";

/**
 * MVP3 – 空壳组件（Baseline on React/Vite）
 * - 不做任何网络请求与业务逻辑
 * - 仅保留最小 UI 与占位区，便于后续逐步“接线”
 * - 关键文案带 data-i18n，后续配字典即可三语切换
 */

export default function App() {
  // 仅用于验证双向绑定 & 将来作为“正文”输入区
  const [text, setText] = useState("");

  // 预留：统一读取 API 基址（暂不使用，只展示）
  const API_BASE = useMemo(() => {
    const qp = (() => {
      try {
        const u = new URL(window.location.href);
        return u.searchParams.get("api")?.trim();
      } catch { return ""; }
    })();
    const envBase = import.meta?.env?.VITE_API_BASE?.trim?.();
    const envUrl  = import.meta?.env?.VITE_API_URL?.trim?.();
    return qp || envBase || envUrl || ""; // 空壳阶段不使用
  }, []);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px" }}>
      {/* 标题 */}
      <h1 data-i18n="title.app" style={{ margin: "0 0 12px" }}>
        MVP3 — App
      </h1>

      {/* 基线提示 */}
      <div
        style={{
          background: "#f0faf0",
          border: "1px solid #bfe6bf",
          padding: "12px 14px",
          borderRadius: 6,
          marginBottom: 18,
          color: "#1f6b1f",
          lineHeight: 1.6,
        }}
      >
        <span data-i18n="hint.mounted">
          如果你看到这段话，说明 React/Vite 已成功挂载到 #root。
        </span>
        <br />
        <small style={{ color: "#3f7f3f" }}>
          (data-i18n 已埋点，后续可切换 🇨🇳🇩🇪🇬🇧)
        </small>
      </div>

      {/* STEP 1：正文 / Text（仅本地状态） */}
      <section style={{ marginBottom: 20 }}>
        <div data-i18n="label.text" style={{ marginBottom: 6 }}>
          正文 / Text
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="这里是占位文本区。后续可作为 PDF/表格生成的来源。"
          data-i18n-placeholder="placeholder.text"
          style={{
            width: "100%",
            height: 220,
            padding: 10,
            border: "1px solid #ddd",
            borderRadius: 6,
            fontFamily:
              "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace",
            fontSize: 13,
          }}
        />
      </section>

      {/* STEP 2：操作区（占位按钮，未接线） */}
      <section style={{ marginBottom: 26 }}>
        <div style={{ marginBottom: 8, color: "#666" }} data-i18n="label.actions">
          操作（占位，尚未接线）
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button disabled title="空壳阶段未接线" data-i18n="btn.health">
            后端健康检查
          </button>
          <button disabled title="空壳阶段未接线" data-i18n="btn.pdf">
            生成 PDF
          </button>
          <button disabled title="空壳阶段未接线" data-i18n="btn.fetchCatalog">
            抓取目录
          </button>
          <button disabled title="空壳阶段未接线" data-i18n="btn.preview50">
            目录写入正文（前 50 条）
          </button>
          <button disabled title="空壳阶段未接线" data-i18n="btn.exportExcel">
            导出 Excel
          </button>
          <button disabled title="空壳阶段未接线" data-i18n="btn.exportTablePdf">
            表格 PDF
          </button>
        </div>
      </section>

      {/* STEP 3：目录抓取结果（占位只读区） */}
      <section>
        <div data-i18n="label.catalogPreview" style={{ marginBottom: 6 }}>
          目录抓取结果（占位）
        </div>
        <textarea
          readOnly
          value=""
          placeholder="空壳组件阶段，这里仅作为『目录抓取结果』的占位显示区。"
          data-i18n-placeholder="placeholder.catalogJson"
          style={{
            width: "100%",
            height: 200,
            padding: 10,
            border: "1px solid #eee",
            borderRadius: 6,
            color: "#999",
            background: "#fafafa",
            fontFamily:
              "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace",
            fontSize: 12,
          }}
        />
      </section>

      {/* 开发信息（只展示，不使用） */}
      <footer style={{ marginTop: 20, color: "#888", fontSize: 12 }}>
        <span data-i18n="label.apiBase">API 基址</span>：{" "}
        <code>{API_BASE || "(not set)"}</code>
        <span style={{ marginLeft: 10, color: "#bbb" }}>
          {/* 之后接线：/v1/api/health /v1/api/pdf /v1/api/catalog/parse
              以及 /v1/api/export/excel、/v1/api/export/table-pdf */}
        </span>
      </footer>
    </div>
  );
}
