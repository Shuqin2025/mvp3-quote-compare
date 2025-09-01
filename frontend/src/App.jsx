// frontend/src/App.jsx
import { useEffect, useRef, useState } from 'react'

// ★★ 根据你的后端部署地址改这里 ★★
const API_BASE = 'https://yunivera-mvp2.onrender.com/v1/api'

function App() {
  const [pingText, setPingText] = useState('未检查 / Nicht geprüft')
  const [scrapeUrl, setScrapeUrl] = useState('https://example.com')
  const [scrapeJson, setScrapeJson] = useState('')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const jsonRef = useRef(null)

  // ---------------- 健康检查 ----------------
  async function ping() {
    try {
      const r = await fetch(`${API_BASE}/health`)
      if (!r.ok) throw new Error(r.status)
      const a = await r.json()
      setPingText(`[PING] ${r.status} OK | OK`)
    } catch (e) {
      setPingText(`[PING] 失败：${String(e)}`)
    }
  }
  useEffect(() => { ping() }, [])

  // ---------------- 抓取 ----------------
  async function doScrape() {
    const url = scrapeUrl.trim()
    if (!url) return alert('请输入要抓取的 URL')

    try {
      const r = await fetch(`${API_BASE}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!r.ok) {
        const t = await r.text().catch(() => '')
        throw new Error(`HTTP ${r.status} - ${t}`)
      }
      const a = await r.json()
      setScrapeJson(JSON.stringify(a, null, 2))
    } catch (e) {
      setScrapeJson(`抓取失败：${String(e)}`)
    }
  }

  // ---------------- 基础回填（title + text） ----------------
  function fillBasic() {
    if (!scrapeJson.trim()) return
    try {
      const data = JSON.parse(scrapeJson)
      const t = data?.title || data?.h1?.[0] || ''
      const approx = data?.approxTextLength
      const pv = data?.preview || ''
      setTitle(t || '')
      setText([
        '【 基本信息 】',
        `名称: ${t || '（未识别）'}`,
        `来源: ${data?.url || ''}`,
        '',
        '【 备注 】',
        '1) 以上为自动识别结果，仅供初审，请以卖家/供应商实际报价为准；',
        '2) 如希望出图/寄样/备货/验货、或批量比价，请直接回复链接。',
        '',
        pv ? `预览：${pv.substring(0, 600)}...` : '',
      ].filter(Boolean).join('\n'))
    } catch {
      alert('JSON 解析失败')
    }
  }

  // ---------------- 站点优先规则 + 启发式抽取 ----------------
  function extractSmart(data) {
    const url = data?.url || ''
    const host = (() => {
      try { return new URL(url).host.toLowerCase() } catch { return '' }
    })()

    let price = null, currency = null, sku = null, moq = null

    const text = JSON.stringify(data || {}).toLowerCase()

    // 站点特判
    if (host.includes('1688.com')) {
      if (!price) {
        const m = text.match(/"price(?:range)?"\s*:\s*"?(?<p>\d+(?:\.\d+)?)"?/)
        price = m?.groups?.p || price
      }
      if (!currency) currency = (text.includes('¥') || text.includes('cny')) ? 'CNY' : currency
      if (!sku) {
        const m = text.match(/"sku(?:id)?"\s*:\s*"?(?<id>[\w\-]+)"?/)
        sku = m?.groups?.id || sku
      }
      if (!moq) {
        const m = text.match(/"moq"\s*:\s*"?(?<q>\d+)/)
        moq = m?.groups?.q || moq
      }
    }
    else if (host.includes('alibaba.com')) {
      if (!price) {
        const m = text.match(/"price"\s*:\s*"?(?<p>\d+(?:\.\d+)?)"?/)
        price = m?.groups?.p || price
      }
      if (!currency) {
        if (text.includes('usd')) currency = 'USD'
        else if (text.includes('eur')) currency = 'EUR'
      }
      if (!sku) {
        const m = text.match(/"model"\s*:\s*"?(?<id>[\w\-]+)"?/)
        sku = m?.groups?.id || sku
      }
      if (!moq) {
        const m = text.match(/"min.?order"\s*:\s*"?(?<q>\d+)/)
        moq = m?.groups?.q || moq
      }
    }
    else if (host.includes('amazon.')) {
      if (!price) {
        const m = text.match(/"price"\s*:\s*"?(?<p>\d+(?:\.\d+)?)"?/)
        price = m?.groups?.p || price
      }
      if (!currency) {
        if (text.includes('€')) currency = 'EUR'
        else if (text.includes('$')) currency = 'USD'
        else if (text.includes('￥') || text.includes('¥')) currency = 'JPY'
      }
      if (!sku) {
        const m = text.match(/"asin"\s*:\s*"?(?<id>[\w\d]+)"/)
        sku = m?.groups?.id || sku
      }
    }
    else if (host.includes('otto.de') || host.includes('hornbach.')) {
      if (!price) {
        const m = text.match(/(?:"price"|preis)"?\s*:\s*"?(?<p>\d+(?:[.,]\d+)?)/)
        price = (m?.groups?.p || '').replace(',', '.') || price
      }
      if (!currency) if (text.includes('€') || text.includes('eur')) currency = 'EUR'
      if (!sku) {
        const m = text.match(/"sku"\s*:\s*"?(?<id>[\w\-]+)"/)
        sku = m?.groups?.id || sku
      }
    }

    // 启发式兜底
    if (!price) {
      const m = text.match(/(?<![a-z])(\d{1,5}(?:[.,]\d{2})?)(?=\s*(?:eur|usd|cny|€|\$|¥))/)
      price = m?.[1]?.replace(',', '.') || price
    }
    if (!currency) {
      if (text.includes('€') || text.includes('eur')) currency = 'EUR'
      else if (text.includes('$') || text.includes('usd')) currency = 'USD'
      else if (text.includes('¥') || text.includes('cny')) currency = 'CNY'
    }

    return { price, currency, sku, moq }
  }

  // ---------------- 智能回填（含价格/币种/SKU/MOQ） ----------------
  function fillSmart() {
    if (!scrapeJson.trim()) return
    try {
      const data = JSON.parse(scrapeJson)
      const t = data?.title || data?.h1?.[0] || ''
      const { price, currency, sku, moq } = extractSmart(data)

      setTitle(t || '')
      const lines = [
        '【 基本信息 】',
        `名称: ${t || '（未识别）'}`,
        `SKU: ${sku || '（未识别）'}`,
        `价格: ${price ?? '（未识别）'} ${currency ?? ''}`.trim(),
        `MOQ: ${moq ?? '（未识别）'}`,
        `来源: ${data?.url || ''}`,
        '',
        '【 备注 】',
        '1) 以上为自动识别结果，仅供初审，请以卖家/供应商实际报价为准；',
        '2) 如需出图/寄样/备货/验货，或批量比价，请直接回复链接。',
      ]
      setText(lines.join('\n'))
    } catch {
      alert('JSON 解析失败')
    }
  }

  // ---------------- 生成 PDF（Blob 下载） ----------------
  async function makePdf() {
    const t = (title || '').trim() || '测试报价单'
    const body = text || ''
    if (!body.trim()) return alert('正文为空')

    try {
      const r = await fetch(`${API_BASE}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // ★★★ 关键：后端以 content/body/rows 兼容，我们传 content 最稳妥
        body: JSON.stringify({ title: t, content: body }),
      })
      if (!r.ok) {
        const tt = await r.text().catch(() => '')
        throw new Error(`HTTP ${r.status} - ${tt}`)
      }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'quote.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('PDF 失败：' + e.message)
      console.error(e)
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: '24px auto', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h2>MVP3：Scrapen + Ausfüllen + PDF erzeugen</h2>

      <div style={{ marginBottom: 8 }}>
        <div>标题 / Titel：</div>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="例如：测试报价单 / Testangebot"
          style={{ width: '100%', padding: 8 }}
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <div>正文 / Text：</div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={10}
          placeholder="在此输入或使用下方『回填/智能回填』自动生成"
          style={{ width: '100%', padding: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
        <button onClick={ping}>后端健康检查 / Backend-Check</button>
        <button onClick={makePdf}>生成 PDF / PDF erzeugen</button>
        <span style={{ color: '#666' }}>{pingText}</span>
      </div>

      <div style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
        API 基址 / API-Basis： <code>{API_BASE}</code>
      </div>

      <hr />

      <h3>🔎 Web-Scraping & 一键回填</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          value={scrapeUrl}
          onChange={e => setScrapeUrl(e.target.value)}
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={doScrape}>抓取 / Scrapen</button>
        <button onClick={fillBasic}>回填（基础）</button>
        <button onClick={fillSmart}>智能回填（含价格/币种/SKU/MOQ）</button>
      </div>

      <textarea
        ref={jsonRef}
        value={scrapeJson}
        onChange={e => setScrapeJson(e.target.value)}
        placeholder="抓取结果将在这里（JSON）"
        rows={12}
        style={{ width: '100%', padding: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
      />
    </div>
  )
}

export default App
