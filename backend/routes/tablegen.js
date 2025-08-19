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
    if (!urls.length) return res.status(400).json({ error: { message: 'urls 不能为空' } })

    const products = []
    for (const u of urls) {
      const p = await crawlProducts(u)
      products.push(...p)
    }

    const translatedHeaders = await translate(fields, lang)
    const translatedProducts = await Promise.all(products.map(async (p) => {
      const np = {}
      for (const f of fields) {
        if (f === 'description') np[f] = await translate(p[f] || '', lang)
        else np[f] = p[f] ?? ''
      }
      if (fields.includes('imageUrl')) np.imageUrl = p.imageUrl
      return np
    }))

    const filesDir = path.join(__dirname, '..', 'files')
    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir)

    const ts = Date.now()
    let excelUrl=null, pdfUrl=null, excelSize=null, pdfSize=null

    if (format.includes('excel')) {
      const excelPath = path.join(filesDir, `tablegen_${ts}.xlsx`)
      await genExcel(excelPath, translatedHeaders, translatedProducts)
      excelUrl = `${process.env.BASE_URL || ''}/files/${path.basename(excelPath)}`
      excelSize = `${(fs.statSync(excelPath).size/1024).toFixed(1)} KB`
    }
    if (format.includes('pdf')) {
      const pdfPath = path.join(filesDir, `tablegen_${ts}.pdf`)
      await genPdf(pdfPath, translatedHeaders, translatedProducts)
      pdfUrl = `${process.env.BASE_URL || ''}/files/${path.basename(pdfPath)}`
      pdfSize = `${(fs.statSync(pdfPath).size/1024).toFixed(1)} KB`
    }

    return res.json({ excel: excelUrl, excelSize, pdf: pdfUrl, pdfSize })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: { message: e.message || 'server error' } })
  }
})

export default router
