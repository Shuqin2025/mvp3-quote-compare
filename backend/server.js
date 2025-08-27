// backend/server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5190;

/**
 * CORS：允许前端域名访问（也可先用 * 放开，等稳定后再收紧）
 * 如需只允许你的前端：
 * origin: ["https://mvp3-frontend.onrender.com"]
 */
app.use(
  cors({
    origin: "*",
  })
);

// 解析 JSON 请求体
app.use(express.json());

/** ---------------- 健康检查 ---------------- */
// 你前端现在会请求 /health，这里返回 200
app.get("/health", (req, res) => {
  res.json({ ok: true, message: "OK" });
});

// 也额外提供 /v1/api/health，防止以后换路径
app.get("/v1/api/health", (req, res) => {
  res.json({ ok: true, message: "OK" });
});

// 兜底根路径，手动打开后端时也能看到提示
app.get("/", (req, res) => {
  res.send("MVP3 backend is running.");
});

/** ---------------- 生成 PDF ----------------
 * POST /v1/api/pdf
 * body: { title: string, content: string }
 */
app.post("/v1/api/pdf", (req, res) => {
  const { title, content } = req.body || {};
  if (!title || !content) {
    return res.status(400).json({ error: "参数缺失：title 和 content 必填" });
  }

  // 响应头：直接把 PDF 流回给浏览器（下载）
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="quote.pdf"'
  );

  const doc = new PDFDocument({ size: "A4", margin: 56 }); // 约 2cm 边距
  doc.pipe(res);

  // 中文字体（可选）：backend/fonts/NotoSansSC-Regular.ttf
  const zhFontPath = path.join(__dirname, "fonts", "NotoSansSC-Regular.ttf");
  if (fs.existsSync(zhFontPath)) {
    try {
      doc.registerFont("zh", zhFontPath);
      doc.font("zh");
    } catch (e) {
      // 字体注册失败就用默认字体
      console.warn("注册中文字体失败，将使用内置字体:", e?.message || e);
    }
  }

  // 标题
  doc.fontSize(22).text(title, { align: "center" });
  doc.moveDown(1.2);

  // 正文
  doc.fontSize(12).text(content, {
    align: "left",
    lineGap: 4,
  });

  doc.end(); // 结束并把流发给浏览器
});

/** ---------------- 启动 ---------------- */
app.listen(PORT, () => {
  console.log(`[mvp3-backend] running at http://localhost:${PORT}`);
});
