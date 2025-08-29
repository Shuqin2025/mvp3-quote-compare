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
 * 先放开，稳定后可改为：
 * origin: ["https://mvp3.yunivera.com", "https://yunivera.com"]
 */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
  })
);

// 解析 JSON 请求体（默认 100kb；提高到 4MB 足够我们用）
app.use(express.json({ limit: "4mb" }));

/** ---------------- 健康检查 ---------------- */
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "mvp3-backend", ts: Date.now() });
});

app.get("/v1/api/health", (req, res) => {
  res.json({ ok: true, service: "mvp3-backend", ts: Date.now() });
});

/** ---------------- 首页兜底 ---------------- */
app.get("/", (req, res) => {
  res.type("text/plain").send("MVP3 backend is running.");
});

/** ---------------- 生成 PDF ----------------
 *  POST /v1/api/pdf
 *  body: { title: string, content?: string, body?: string }
 *  - 默认 inline 浏览器打开；若 query 带 ?dl=1 则触发下载
 */
app.post("/v1/api/pdf", (req, res) => {
  try {
    const { title = "报价单", content, body } = req.body || {};
    const text = (typeof content === "string" && content.trim().length)
      ? content
      : (typeof body === "string" ? body : "");

    if (!title || !text) {
      return res
        .status(400)
        .json({ ok: false, error: "参数缺失：title 与 content/body 必填" });
    }

    // inline 预览；?dl=1 时改为下载
    const inline = !("dl" in req.query);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${inline ? "inline" : "attachment"}; filename="quote.pdf"`
    );

    // 创建 PDF 文档
    const doc = new PDFDocument({ size: "A4", margin: 56 }); // 约 2cm 边距
    doc.pipe(res);

    // 中文字体：backend/fonts/NotoSansSC-Regular.ttf（可选）
    const zhFontPath = path.join(__dirname, "fonts", "NotoSansSC-Regular.ttf");
    if (fs.existsSync(zhFontPath)) {
      try {
        doc.registerFont("zh", zhFontPath);
        doc.font("zh");
      } catch (e) {
        console.warn("注册中文字体失败，将使用内置字体:", e?.message || e);
      }
    }

    // 标题
    doc.fontSize(22).text(title, { align: "center" });
    doc.moveDown(1.2);

    // 正文
    doc.fontSize(12).text(text, {
      align: "left",
      lineGap: 4,
    });

    doc.end(); // 结束 PDF 输出
  } catch (err) {
    console.error("[/v1/api/pdf] error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/** ---------------- 全局错误兜底（可选） ---------------- */
app.use((err, req, res, next) => {
  console.error("[Unhandled]", err);
  if (res.headersSent) return;
  res.status(500).json({ ok: false, error: "Internal Server Error" });
});

/** ---------------- 启动 ---------------- */
app.listen(PORT, () => {
  console.log(`[mvp3-backend] running at http://0.0.0.0:${PORT}`);
});
