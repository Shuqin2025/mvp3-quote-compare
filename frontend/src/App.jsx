import { useState } from "react"

const API_BASE = "https://yunivera-mvp2.onrender.com/v1/api"

export default function App() {
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [scrapeUrl, setScrapeUrl] = useState("https://example.com")
  const [scrapeResult, setScrapeResult] = useState("")
  const [status, setStatus] = useState("Bereit. / 就绪。")

  // 后端健康检查
  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`)
      const data = await res.json()
      setStatus(`[PING] ${res.status} ${res.statusText} | OK`)
      console.log("Health:", data)
    } catch (err) {
      setStatus("Backend 不可用 ❌")
    }
  }

  // 生成 PDF
  const generatePDF = async () => {
    try {
      const res = await fetch(`${API_BASE}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: text,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "quote.pdf"
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert("PDF 生成失败: " + err)
    }
  }

  // 抓取网页
  const doScrape = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/scrape?url=${encodeURIComponent(scrapeUrl)}`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setScrapeResult(JSON.stringify(data, null, 2))
    } catch (err) {
      setScrapeResult("抓取失败: " + err)
    }
  }

  // 用抓取结果回填
  const fillBasic = () => {
    try {
      const obj = JSON.parse(scrapeResult)
      if (obj.title) setTitle(obj.title)
      if (obj.preview) setText(obj.preview)
    } catch (e) {
      alert("无法解析抓取结果")
    }
  }

  // 智能回填：价格 / 货币 / SKU / MOQ
  const fillSmart = () => {
    try {
      const obj = JSON.parse(scrapeResult)
      let body = ""
      if (obj.vendor) body += `卖家: ${obj.vendor}\n`
      if (obj.price && obj.currency)
        body += `价格: ${obj.price} ${obj.currency}\n`
      if (obj.sku) body += `SKU: ${obj.sku}\n`
      if (obj.moq) body += `MOQ: ${obj.moq}\n`
      if (obj.preview) body += `\n产品介绍:\n${obj.preview}\n`
      setText(body)
    } catch (e) {
      alert("无法解析抓取结果")
    }
  }

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h2>MVP3: Scrapen + Ausfüllen + PDF erzeugen</h2>

      <div>
        <label>
          标题 / Titel:
          <input
            style={{ width: "80%", margin: "5px" }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如: 测试报价单 / Testangebot"
          />
        </label>
      </div>

      <div>
        <label>
          正文 / Text:
          <textarea
            style={{ width: "80%", height: "120px", margin: "5px" }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="在此输入或使用下方回填/智能回填 自动生成"
          />
        </label>
      </div>

      <div>
        <button onClick={checkHealth}>后端健康检查 / Backend-Check</button>
        <button onClick={generatePDF}>生成 PDF / PDF erzeugen</button>
        <span style={{ marginLeft: "10px" }}>{status}</span>
      </div>

      <hr />

      <h3>🔍 Web-Scraping & 一键回填</h3>
      <input
        style={{ width: "60%" }}
        value={scrapeUrl}
        onChange={(e) => setScrapeUrl(e.target.value)}
      />
      <button onClick={doScrape}>抓取 / Scrapen</button>
      <button onClick={fillBasic}>回填 (基础)</button>
      <button onClick={fillSmart}>智能回填 (含价格/币种/SKU/MOQ)</button>

      <pre
        style={{
          background: "#f5f5f5",
          padding: "10px",
          marginTop: "10px",
          whiteSpace: "pre-wrap",
        }}
      >
        {scrapeResult}
      </pre>
    </div>
  )
}
