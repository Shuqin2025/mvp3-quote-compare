import React, { useEffect, useMemo } from "react";

/**
 * MVP3 – UI骨架（空壳，方便逐步接回功能）
 * - 只渲染结构、id、data-i18n，不做任何真实调用
 * - 语言切换与“开发者模式”交给 public/ui-enhance.js 处理
 * - 后续把真实逻辑按模块逐步接回（抓取 / 预览 / 导出）
 */
export default function App() {
  // 仅用于“页面上显示 API 基址” —— 读取环境或 URL 覆盖（不做请求）
  const apiBase = useMemo(() => {
    try {
      const u = new URL(window.location.href);
      const fromQuery = u.searchParams.get("api")?.trim();
      // Render 的环境变量（若你在 vite.config 有 define，也可在此挂载 import.meta.env）
      const fromEnv =
        (import.meta?.env?.VITE_API_BASE?.trim?.() ?? "") ||
        (import.meta?.env?.VITE_API_URL?.trim?.() ?? "");
      return (fromQuery || fromEnv || "").trim();
    } catch {
      return "";
    }
  }, []);

  // 让 ui-enhance 接管语言切换、开发者模式开关、按钮主次风格等
  useEffect(() => {
    // 延迟到下一帧，确保节点都在
    const t = requestAnimationFrame(() => {
      if (window?.uiEnhance?.mount) window.uiEnhance.mount();
    });
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px" }}>
      {/* 顶部标题 */}
      <h1 data-i18n="title_app" style={{ margin: "0 0 12px" }}>
        MVP3 — App
      </h1>

      {/* 绿色提示（baseline 期间仍保留，后续可移除） */}
      <div
        role="note"
        aria-live="polite"
        style={{
          background: "#f0fae0",
          border: "1px solid #b6e56d",
          padding: "12px 14px",
          borderRadius: 6,
          marginBottom: 18,
        }}
      >
        <span data-i18n="baseline_hint">
          如果你能看到这个页面，说明前端框架已就绪（React/Vite + i18n +
          UI增强）。
        </span>
      </div>

      {/* 文本区（正文 / Text） */}
      <section aria-labelledby="secText">
        <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
          <strong id="secText" data-i18n="section_text">
            正文 / Text
          </strong>
        </div>

        <textarea
          id="txt"
          aria-labelledby="secText"
          placeholder=""
          data-i18n-placeholder="txt_placeholder"
          style={{
            width: "100%",
            height: 260,
            resize: "vertical",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: 13,
            lineHeight: 1.6,
            padding: 10,
            borderRadius: 6,
            border: "1px solid #ddd",
          }}
        />

        {/* 按钮工具条（主/次风格由 ui-enhance 接管） */}
        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {/* 仅开发者模式显示：后端健康检查 & PING */}
          <button id="btn-backend-check" className="dev-only" data-i18n="btn_backend_check">
            后端健康检查 / Backend-Check
          </button>
          <span className="dev-only" id="ping" data-i18n="ping_badge">
            [PING] 尚未检查
          </span>

          {/* 生成 PDF（保留一个） */}
          <button id="btn-generate-pdf" data-i18n="btn_pdf">
            生成 PDF / PDF erzeugen
          </button>
        </div>

        {/* API 基址（开发者模式显示） */}
        <div className="dev-only" style={{ marginTop: 8, color: "#6c6c6c" }}>
          <small>
            <span data-i18n="api_basis">API 基址 / API-Basis</span>：{" "}
            <code id="api-base-text">{apiBase || "-"}</code>
          </small>
        </div>
      </section>

      {/* 目录抓取 Demo */}
      <section aria-labelledby="secCatalog" style={{ marginTop: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <strong id="secCatalog" data-i18n="section_catalog">
            目录抓取 Demo（/v1/api/catalog/parse）
          </strong>
        </div>

        {/* URL 输入与操作按钮 */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input
            id="catalogUrl"
            type="text"
            defaultValue=""
            data-i18n-placeholder="catalog_placeholder"
            placeholder="https://example.com"
            style={{
              flex: "1 1 520px",
              minWidth: 280,
              height: 34,
              padding: "0 10px",
              borderRadius: 6,
              border: "1px solid #ddd",
              fontSize: 14,
            }}
          />
          <button id="btn-fetch-catalog" data-i18n="btn_fetch">
            抓取目录
          </button>
          <button id="btn-preview" data-i18n="btn_preview">
            目录写入正文（前 50 条）
          </button>
          <span aria-hidden="true" style={{ opacity: 0.6 }}>→</span>
          <button id="btn-export-excel" data-i18n="btn_excel">
            导出 Excel
          </button>
          <button id="btn-export-pdf" data-i18n="btn_pdf2">
            表格 PDF
          </button>
        </div>

        {/* 结果预览（原始 JSON）—— 仅开发者模式显示 */}
        <textarea
          id="result"
          className="dev-only"
          data-i18n-placeholder="json_result_placeholder"
          placeholder="目录抓取结果 JSON 会显示在这里"
          style={{
            width: "100%",
            height: 300,
            resize: "vertical",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: 13,
            lineHeight: 1.5,
            padding: 10,
            borderRadius: 6,
            border: "1px solid #ddd",
          }}
        />
      </section>

      {/* 页脚（可放支持站点 / 隐私政策 / 联系） */}
      <footer style={{ marginTop: 26, opacity: 0.75 }}>
        <small id="footer-links" data-i18n="footer_links">
          支持的网站 · 隐私政策 · 联系我们
        </small>
      </footer>
    </div>
  );
}
