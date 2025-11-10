// src/App.jsx — unified API base + image proxy + no hardcoded /v1/*
// This file expects Vite. It imports helpers from the single source of truth (/export-xlsx.js).
import React, { useMemo, useState } from 'react'
import { getApiBase, imageProxy, exportToXlsxByItems, exportToXlsxByUrl } from '/export-xlsx.js'

/**
 * Small util that builds a catalog API url safely.
 * Example: catalogPath('_probe') -> `${API_BASE}/catalog/_probe`
 *          catalogPath(`parse?url=${encodeURIComponent(x)}`)
 */
function useCatalog() {
  const API_BASE = useMemo(() => getApiBase(), [])
  const catalogPath = (path) => {
    const p = path.startsWith('/') ? path : `/${path}`
    return `${API_BASE}/catalog${p}`
  }
  return { API_BASE, catalogPath }
}

export default function App() {
  const { API_BASE, catalogPath } = useCatalog()
  const [link, setLink] = useState('https://www.memoryking.de/computer/')
  const [limit, setLimit] = useState(50)
  const [rows, setRows] = useState([])
  const [adapter, setAdapter] = useState('')
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)

  async function fetchCatalog() {
    try {
      setLoading(true)
      const url = catalogPath(`parse?url=${encodeURIComponent(link)}&limit=${limit}`)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`catalog fetch failed: ${res.status}`)
      const data = await res.json()
      setAdapter(data.adapter || '')
      setCount(data.count || (data.items?.length ?? 0))
      // Normalize to rows expected by table
      const list = (data.rows || data.items || []).map((x, i) => ({
        idx: i + 1,
        sku: x.sku || '',
        title: x.title || '',
        // IMPORTANT: never expose raw third‑party images, always through our proxy to avoid CORS/blocked lazy images
        img: x.img ? imageProxy(x.img, 'raw') : '',
        desc: x.desc || '',
        moq: x.moq || '',
        price: x.price || '',
        url: x.url || '#',
      }))
      setRows(list)
    } catch (err) {
      console.error(err)
      alert('抓取失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  async function onExportByItems() {
    if (!rows.length) return alert('没有数据可导出')
    try {
      await exportToXlsxByItems(
        rows.map(r => ({
          title: r.title,
          link: r.url,
          image: r.img, // 已经是代理后的绝对地址
        })),
        { withImages: true, filename: '商品数据导出.xlsx' }
      )
    } catch (err) {
      console.error(err)
      alert('导出失败，请查看控制台日志')
    }
  }

  async function onExportByUrl() {
    const url = catalogPath(`parse?url=${encodeURIComponent(link)}&limit=${limit}`)
    try {
      await exportToXlsxByUrl(url, { withImages: true, filename: '商品数据导出.xlsx' })
    } catch (err) {
      console.error(err)
      alert('导出失败，请查看控制台日志')
    }
  }

  return (
    <div className="wrap">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input style={{ flex: 1 }} value={link} onChange={e => setLink(e.target.value)} />
        <select value={limit} onChange={e => setLimit(Number(e.target.value))}>
          {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <button className="btn primary" disabled={loading} onClick={fetchCatalog}>抓取目录</button>
        <button className="btn" disabled={!rows.length} onClick={onExportByItems}>导出Excel（就地行）</button>
        <button className="btn" onClick={onExportByUrl}>导出Excel（后端直连）</button>
      </div>

      <div className="alert ok" style={{ display: adapter ? 'block' : 'none' }}>
        Adapter: {adapter} | Count: {count}
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item No.</th>
            <th>Picture</th>
            <th>Description</th>
            <th>MOQ</th>
            <th>Unit Price</th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.idx}>
              <td>{r.idx}</td>
              <td>{r.sku}</td>
              <td>{r.img ? <img className="img_thumb" src={r.img} alt="" /> : '—'}</td>
              <td>{r.title}</td>
              <td>{r.moq}</td>
              <td>{r.price}</td>
              <td>{r.url && r.url !== '#' ? <a href={r.url} target="_blank">Open</a> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
