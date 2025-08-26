# MVP 3 — 邮件发送 + 客户行为追踪档案（本地可跑 / 无需真实 SMTP）

## 功能
- 生成“含追踪像素 & 跳转跟踪链接”的邮件 HTML（不实际发信，便于本地演示）
- 记录：打开/点击/回复（回复为手动标记）
- 客户档案：最近沟通、历史报价数、偏好（示例字段，可扩展）
- 前端页面：收件人、主题、正文、选择“报价单编号”，点击**发送**后可在右侧看到行为流水

## 快速开始

### 后端
```bash
cd backend
cp .env.example .env
npm install
npm run dev   # http://localhost:5184
```

### 前端
```bash
cd ../frontend
cp .env.example .env   # VITE_API_BASE=http://localhost:5184
npm install
npm run dev            # http://localhost:5173
```

## 主要接口
- `POST /v1/api/mail/send`  生成一封带追踪参数的“邮件”，返回生成的 HTML 及 `messageId`
- `GET  /v1/api/mail/activities?messageId=...`  查看该邮件的行为流水
- `POST /v1/api/mail/mark-replied` 标记已回复
- 追踪像素：`GET /t/p.gif?mid=...`  （被加载即视为“打开”）
- 链接跳转：`GET /t/r?mid=...&url=...`  （跳转前记录“点击”）
