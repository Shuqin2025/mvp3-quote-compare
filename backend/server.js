// backend/server.js
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5190;

/** ---------------- CORS ----------------
 * 上线后可收紧 origin 白名单
 */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
  })
);

// 解析 JSON（提高上限，避免大文本触发 413）
app.use(express.json({ limit: "4mb" }));

/** ---------------- 健康检查 ---------------- */
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "mvp3-backend", ts: Date.now() });
});
app.get("/v1/api/health", (_req, res) => {
  res.json({ ok: true, service: "mvp3-backend", ts: Date.now() });
});

/** ---------------- 首页兜底 ---------------- */
app.get("/", (_req, res) => {
  res.type("text/plain").send("MVP3 backend is running. Try /v1/api/health");
});

/** ---------------- 生成 PDF（流式返回） ----------------
 * POST /v1/api/pdf
 * body:
 *   { title: string, content?: string, body?: string }
 * - 默认 inline 在浏览器打开；?dl=1 强制下载
 */
app.post("/v1/api/pdf", (req, res) => {
  // 1) 参数兜底
  const { title = "报价单 / Quote", content, body } = req.body || {};
  const text =
    (typeof content === "string" && content.trim()) ||
    (typeof body === "string" && body) ||
    "";

  if (!title || !text) {
    return res
      .status(400)
      .json({ ok: false, error: "ROWS_REQUIRED_OR_EMPTY_TEXT" });
  }

  // 2) 响应头：application/pdf + inline/attachment
  const inline = !("dl" in req.query);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="quote.pdf"`
  );

  // 3) 创建 PDF 文档并直接 pipe 到响应
  const doc = new PDFDocument({ size: "A4", margin: 56 }); // 约 2cm 边距

  // —— 关键：处理异步错误，避免 500
  const onFatal = (err) => {
    console.error("[/v1/api/pdf] stream error:", err);
    // 如果尚未发过头，就回 JSON 错误；否则尽量结束流
    if (!res.headersSent) {
      try {
        res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
      } catch {}
    } else {
      try {
        res.end();
      } catch {}
    }
  };
  doc.on("error", onFatal);
  res.on("error", onFatal);
  res.on("close", () => {
    // 客户端断开时安全结束，避免 write after end
    try {
      doc.end();
    } catch {}
  });

  doc.pipe(res);

  // 4) 字体：优先加载项目自带的中文字体；没有就退回内置 Helvetica
  const fontCandidates = [
    path.join(__dirname, "fonts", "NotoSansSC-Regular.otf"),
    path.join(__dirname, "fonts", "NotoSansSC-Regular.ttf"),
    path.join(__dirname, "fonts", "NotoSansCJKsc-Regular.otf"),
  ];
  let zhFont = null;
  for (const p of fontCandidates) {
    if (fs.existsSync(p)) {
      zhFont = p;
      break;
    }
  }
  if (zhFont) {
    try {
      doc.registerFont("zh", zhFont);
      doc.font("zh");
    } catch (e) {
      console.warn("注册中文字体失败，回退内置字体：", e?.message || e);
    }
  }

  // 5) 内容
  try {
    doc.fontSize(22).text(String(title), { align: "center" });
    doc.moveDown(1.2);

    doc.fontSize(12).text(String(text), {
      align: "left",
      lineGap: 4,
    });
  } catch (e) {
    // 布局/字体异常也保护
    return onFatal(e);
  }

  // 6) 结束：触发流式发送
  doc.end();
});

/** ---------------- 全局错误兜底（可选） ---------------- */
app.use((err, _req, res, _next) => {
  console.error("[Unhandled]", err);
  if (!res.headersSent) {
    res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
});

/** ---------------- 启动 ---------------- */
app.listen(PORT, () => {
  console.log(`[mvp3-backend] running at http://0.0.0.0:${PORT}`);
});
