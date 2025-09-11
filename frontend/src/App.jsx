import React, { useMemo } from "react";

/**
 * MVP3 — 页面骨架（纯静态，无业务逻辑 / 无接口）
 * - 保留简洁 UI：头部、工具栏、主内容区(预览)、侧栏(开发者面板)、页脚
 * - 文案均加 data-i18n，后续接入 i18n.js 可直接切换三语
 * - dev 面板：地址栏加 ?dev=1 可见（仅占位，不依赖任何接口）
 */
export default function App() {
  // 是否显示开发者面板（占位），仅当 ?dev=1 时显示
  const showDevPanel = useMemo(() => {
    try {
      const u = new URL(window.location.href);
      return (u.searchParams.get("dev") || "").trim() === "1";
    } catch {
      return false;
    }
  }, []);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px" }}>
      {/* 顶部标题 */}
      <header style={{ margin: "0 0 12px" }}>
        <h1 data-i18n="title.app" style={{ margin: "0 0 12px" }}>
          MVP3 — App
        </h1>
        <p data-i18n="hint.react_ok" style={{ margin: 0, color: "#666" }}>
          如果你看到这段话，说明 React/Vite 已成功挂载到 #root。
        </p>
      </header>

      {/* 状态条（占位，后续可替换为业务性的提醒或 banner） */}
      <section
        aria-label="status"
        style={{
          background: "#f0faf0",
          border: "1px solid #d6eed6",
          padding: "12px 14px",
          borderRadius: 6,
          margin: "16px 0 18px",
        }}
      >
        <span data-i18n="banner.placeholder">
          这是页面骨架的占位提示（无脚本、无接口），用于验证部署是否稳定。
        </span>
      </section>

      {/* 顶部工具栏（按钮均为占位，禁用态。第 3 步再接业务） */}
      <section
        aria-label="toolbar"
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div
          data-i18n="toolbar.title"
          style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}
        >
          目录抓取（占位）
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button data-i18n="btn.fetch" disabled title="占位">
            抓取目录
          </button>
          <button data-i18n="btn.preview" disabled title="占位">
            预览（前 50 条）
          </button>
          <span aria-hidden>→</span>
          <button data-i18n="btn.excel" disabled title="占位">
            导出 Excel
          </button>
          <button data-i18n="btn.pdf" disabled title="占位">
            生成 PDF
          </button>
        </div>
      </section>

      {/* 主体两列布局：左侧预览区 + 右侧（可选）开发者面板 */}
      <main
        style={{
          display: "grid",
          gridTemplateColumns: showDevPanel ? "1fr 300px" : "1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* 左侧：抓取结果预览区（大块占位） */}
        <section
          aria-label="preview"
          style={{
            border: "1px solid #e6e6e6",
            borderRadius: 8,
            minHeight: 360,
            padding: 14,
            background: "#fff",
          }}
        >
          <div
            data-i18n="card.preview.title"
            style={{ fontWeight: 600, marginBottom: 8 }}
          >
            抓取结果预览区
          </div>
          <div
            data-i18n="card.preview.desc"
            style={{ color: "#888", fontSize: 14 }}
          >
            占位区域：后续将显示抓取返回的 JSON 简要预览、或转成表格后的展示。
          </div>

          <div
            style={{
              marginTop: 12,
              border: "1px dashed #d7d7d7",
              borderRadius: 6,
              minHeight: 280,
              background:
                "repeating-linear-gradient(45deg, #fafafa, #fafafa 10px, #f5f5f5 10px, #f5f5f5 20px)",
            }}
          />
        </section>

        {/* 右侧：开发者面板（仅 ?dev=1 显示，占位） */}
        {showDevPanel && (
          <aside
            aria-label="dev-panel"
            style={{
              border: "1px solid #e6e6e6",
              borderRadius: 8,
              padding: 14,
              background: "#fff",
            }}
          >
            <div
              data-i18n="card.dev.title"
              style={{ fontWeight: 600, marginBottom: 8 }}
            >
              开发者面板（dev=1）
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#666", lineHeight: 1.8 }}>
              <li data-i18n="card.dev.item.env">
                这里可以放环境变量与接口基址（后续接入）。
              </li>
              <li data-i18n="card.dev.item.ping">
                可在此添加健康检查 /ping（后续接入）。
              </li>
              <li data-i18n="card.dev.item.logs">
                也可打印关键信息用于排查问题（后续接入）。
              </li>
            </ul>
          </aside>
        )}
      </main>

      {/* 页脚占位 */}
      <footer
        style={{
          marginTop: 28,
          paddingTop: 12,
          borderTop: "1px solid #eee",
          color: "#999",
          fontSize: 13,
        }}
      >
        <span data-i18n="footer.note">
          © MVP3 — 页面骨架（占位版）。确认部署稳定后，将逐步接回业务逻辑。
        </span>
      </footer>
    </div>
  );
}
