import React, { useState } from 'react'

const apiBase = import.meta.env.VITE_API_BASE || ''

export default function MultiLangTableMVP() {
  const [urls, setUrls] = useState('')
  const [fields, setFields] = useState({ name: true, imageUrl: true, price: true, moq_value: true, description: false })
  const [lang, setLang] = useState('zh')
  const [formats, setFormats] = useState({ excel: true, pdf: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resultLinks, setResultLinks] = useState(null)

  const handleGenerate = async () => {
    setLoading(true); setError(null); setResultLinks(null)
    try {
      const response = await fetch(`${apiBase}/v1/api/tablegen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: urls.split('\n').map(u => u.trim()).filter(Boolean),
          fields: Object.keys(fields).filter(k => fields[k]),
          lang,
          format: Object.keys(formats).filter(f => formats[f]).join(',') || 'excel'
        })
      })
      const data = await response.json()
      if (data.error) setError(data.error.message || '生成失败')
      else setResultLinks(data)
    } catch (e) {
      setError(e.message || '网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{padding:'24px', maxWidth: 900, margin:'0 auto', fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,Roboto'}}>
      <h1 style={{fontSize: 24, fontWeight: 700, marginBottom: 16}}>多语言表格制作 MVP</h1>

      <label style={{display:'block', marginBottom:8}}>产品页面 URL 列表（每行一个）</label>
      <textarea
        style={{width:'100%', border:'1px solid #ddd', padding:8, height:140, marginBottom:16}}
        value={urls}
        onChange={e => setUrls(e.target.value)}
        placeholder="https://example.com/prod1"
      />

      <div style={{marginBottom:16}}>
        <div style={{marginBottom:8}}>选择需抓取字段：</div>
        {Object.keys(fields).map(key => (
          <label key={key} style={{marginRight:16}}>
            <input type="checkbox" checked={fields[key]}
              onChange={() => setFields(prev => ({...prev, [key]: !prev[key]}))} /> {key}
          </label>
        ))}
      </div>

      <div style={{marginBottom:16}}>
        <div style={{marginBottom:8}}>选择语言：</div>
        {['zh','en','de'].map(l => (
          <label key={l} style={{marginRight:16}}>
            <input type="radio" name="lang" checked={lang===l} onChange={() => setLang(l)} /> {l==='zh'?'中文':l==='en'?'English':'Deutsch'}
          </label>
        ))}
      </div>

      <div style={{marginBottom:16}}>
        <div style={{marginBottom:8}}>导出格式：</div>
        <label style={{marginRight:16}}><input type="checkbox" checked={formats.excel} onChange={() => setFormats(p=>({...p, excel: !p.excel}))}/> Excel</label>
        <label style={{marginRight:16}}><input type="checkbox" checked={formats.pdf} onChange={() => setFormats(p=>({...p, pdf: !p.pdf}))}/> PDF</label>
      </div>

      {error && <div style={{color:'#c00', marginBottom:16}}>错误：{error}</div>}

      <button disabled={loading} onClick={handleGenerate}
        style={{position:'fixed', right:24, bottom:24, background:'#2563eb', color:'#fff', border:'none', padding:'12px 20px', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.15)', cursor:'pointer', opacity: loading?0.6:1}}>
        {loading ? '生成中…' : '生成表格'}
      </button>

      <div style={{marginTop:24}}>
        {!resultLinks && !loading && <p style={{color:'#777'}}>暂无可下载文件</p>}
        {resultLinks && (
          <div>
            <h2 style={{fontSize:18, fontWeight:600, marginBottom:8}}>下载链接</h2>
            {resultLinks.excel && <div style={{marginBottom:6}}>
              <a href={resultLinks.excel} target="_blank">下载 Excel</a>
              <span style={{marginLeft:8, color:'#888'}}>{resultLinks.excelSize || ''}</span>
            </div>}
            {resultLinks.pdf && <div>
              <a href={resultLinks.pdf} target="_blank">下载 PDF</a>
              <span style={{marginLeft:8, color:'#888'}}>{resultLinks.pdfSize || ''}</span>
            </div>}
          </div>
        )}
      </div>
    </div>
  )
}
