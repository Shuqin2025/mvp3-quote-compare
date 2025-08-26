// --- 保持你已有的引入 ---
import express from "express";
import bodyParser from "body-parser";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5190;

app.use(bodyParser.json());

// 健康检查
app.get("/v1/api/hello", (req, res) => {
  res.json({ message: "Hello from backend" });
});

// ✅ PDF 生成接口（内嵌中文字体）
app.post("/v1/api/pdf", (req, res) => {
  const { title, content } = req.body || {};
  if (!title || !content) {
    return res.status(400).json({ error: "title 和 content 是必需的" });
  }

  // 1) 指向中文字体文件
  const fontZh = path.join(__dirname, "fonts", "NotoSansSC-Regular.ttf");
  if (!fs.existsSync(fontZh)) {
    return res
      .status(500)
      .json({ error: "缺少中文字体: backend/fonts/NotoSansSC-Regular.ttf" });
  }

  // 2) 生成 PDF
  const outPath = path.join(__dirname, `${Date.now()}-output.pdf`);
  const doc = new PDFDocument({ size: "A4", margin: 56 }); // 2cm 左右边距
  const stream = fs.createWriteStream(outPath);

  doc.pipe(stream);

  // 3) 注册并启用中文字体
  doc.registerFont("zh", fontZh);

  // 标题
  doc.font("zh").fontSize(22).text(title, { align: "center" });
  doc.moveDown(1.2);

  // 正文
  doc.font("zh").fontSize(12).text(content, {
    align: "left",
    lineGap: 4,
  });

  doc.end();

  // 4) 下载并删除临时文件
  stream.on("finish", () => {
    res.download(outPath, "output.pdf", () => {
      fs.unlink(outPath, () => {});
    });
  });
});

app.listen(PORT, () => {
  console.log(`[mvp3-backend] running at http://localhost:${PORT}`);
});
