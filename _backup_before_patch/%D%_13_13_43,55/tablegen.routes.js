import { Router } from 'express'
import { crawlProducts } from '../services/crawler.js'
import { translate } from '../services/translate.js'
import { genExcel } from '../services/excel.js'
import { genPdf } from '../services/pdf.js'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const router = Router()

router.post('/tablegen', async (req, res) => {
  try {
    const { urls = [], fields = [], lang = 'zh', format = 'excel' } = req.body || {}
    if (!urls.length) {
      return res.status(400).json({ error: { message: 'urls 不能为空' } })
    }

    const products = []
    for (const u of urls) {
      const p = await crawlProducts(u)
      products.push(...p)
    }

    const translatedHeaders = await translate(fields, lang)
    const translatedProducts = await Promise.all(
      products.map(async (p) => {
        const np = {}
        for (const f of fields) {
          if (f === 'description') {
            np[f] = await translate(p[f] || '', lang)
          } else {
            np[f] = p[f] || ''
          }
        }
        if (fields.includes('imageUrl')) np.imageUrl = p.imageUrl
        return np
      })
    )

    let filePath
    if (format === 'excel') {
      filePath = await genExcel(translatedProducts, translatedHeaders)
    } else if (format === 'pdf') {
      filePath = await genPdf(translatedProducts, translatedHeaders)
    } else {
      return res.status(400).json({ error: { message: '不支持的格式' } })
    }

    // ✅ 正确的 URL 拼接（不再使用错误的 `or`）
    const base = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5174}`
    const fileUrl = `${base}/files/${path.basename(filePath)}`

    return res.json({ url: fileUrl })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: { message: err.message } })
  }
})

export default router
