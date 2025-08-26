import React, { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_BASE || 'http://localhost:5184'

export default function App() {
  const [to, setTo] = useState('buyer@example.com')
  const [subject, setSubject] = useState('Ihre Anfrage - Angebot')
  const [body, setBody] = useState('Dear Mr. Smith,\nPlease see attached our offer...')
  const [quoteId, setQuoteId] = useState('B001')
  const [messageId, setMessageId] = useState(null)
  const [html, setHtml] = useState('')
  const [acts, setActs] = useState([])
  const [loading, setLoading] = useState(false)

  // 发送邮件
  const sendMail = async () => {
    setLoading(true)
    setActs([])
    try {
      const res = await fetch(`${API}/v1/api/mail/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body, quoteId })
      })
      const data = await res.json()
      setMessageId(data.messageId)
      setHtml(data.html || '')
    } catch (err) {
      console.error(err)
      alert('Error sending mail: ' + err.message)
    }
    setLoading(false)
  }

  // 轮询活动状态
  useEffect(() => {
    if (!messageId) return
    const t = setInterval(async () => {
      try {
        const res = await fetch(`${API}/v1/api/mail/activities?messageId=${messageId}`)
        const d = await res.json()
        setActs(d.activities || [])
      } catch (err) {
        console.error(err)
      }
    }, 1500)
    return () => clearInterval(t)
  }, [messageId])

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📧 Send Offer Mail</h1>

      <div className="mb-2">
        <label className="block text-sm">To:</label>
        <input valu
