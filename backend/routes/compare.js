import { Router } from 'express'
import PDFDocument from 'pdfkit'
import path from 'path'
import fs from 'fs'

export default function routes(filesDir) {
  const router = Router()

  // 健康检查
  router.get('/ping', (req, res) => res.json({ ok: true }))

  // 导出比价PDF
  router.post('/compare/export-pdf', async (req, res) => {
    try {
      const { title = '报价对比', items = [] } = req.body

      // 计算每个 SKU 的最低价（简单按 price 数值最小）
      const bestMap = {} // sku -> 最低价
      items.forEach(it => {
        const price = Number(String(it.price).replace(',', '.'))
        if (!isFinite(price)) return
        const key = (it.sku || '').trim()
        if (!key) return
        if (!(key in bestMap) || price < bestMap[key]) bestMap[key] = price
      })

      // pdf 输出文件
      const filename = `compare_${Date.now()}.pdf`
      const outPath = path.join(filesDir, filename)
      const stream = fs.createWriteStream(outPath)
      const doc = new PDFDocument({ size: 'A4', margin: 36 })

      // 字体（中文不乱码）——放到 backend/fonts/NotoSansSC-Regular.ttf
      const fontPath = path.join(filesDir, '..', 'fonts', 'NotoSansSC-Regular.ttf')
      if (fs.existsSync(fontPath)) doc.font(fontPath)
      else doc.font('Times-Roman') // 兜底（可能乱码）

      doc.pipe(stream)

      // 标题
      doc.fontSize(18).text(title, { align: 'left' })
      doc.moveDown(0.5)

      // 表头
      const headers = ['Vendor', 'SKU', 'Name', 'Price', 'Qty', 'LeadTime', 'Notes']
      doc.fontSize(11).text(headers.join(' | '))
      doc.moveDown(0.25)
      doc.text('-'.repeat(110))

      // 表体
      items.forEach((it) => {
        const priceNum = Number(String(it.price).replace(',', '.'))
        const isBest = isFinite(priceNum) && (bestMap[(it.sku || '').trim()] === priceNum)

        const line = [
          it.vendor || '',
          it.sku || '',
          it.name || '',
          isFinite(priceNum) ? priceNum.toString() : (it.price || ''),
          it.qty || '',
          it.leadtime || '',
          it.notes || ''
        ].join(' | ')

        if (isBest) doc.fillColor('#1f883d') // 低价标绿
        else doc.fillColor('#000000')

        doc.text(line)
      })

      doc.end()

      stream.on('finish', () => {
        const host = `${req.protocol}://${req.get('host')}`
        res.json({ pdf: `${host}/files/${filename}` })
      })
    } catch (e) {
      console.error('[compare/export-pdf] error:', e)
      res.status(500).json({ error: 'export_failed' })
    }
  })

  return router
}
