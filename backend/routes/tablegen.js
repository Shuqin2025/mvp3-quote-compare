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

    // translate headers (stubbed) and map rows
    const translatedHeaders = await translate(fields, lang)
    const translatedProducts = await Promise.all(products.map(async (p) => {
      const np = {}
      for (const f of fields) {
        if (f === 'description') {
          np[f] = await translate(p[f] || '', lang)
        } else {
          np[f] = p[f] ?? ''
        }
      }
      if (fields.includes('imageUrl')) np.imageUrl = p.imageUrl
      return np
    }))

    const filesDir = path.join(__dirname, '..', 'files')
    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir)

    const timestamp = Date.now()
    let excelUrl=null, pdfUrl=null, excelSize=null, pdfSize=null

    if (format.includes('excel')) {
      const excelPath = path.join(filesDir, `tablegen_${timestamp}.xlsx`)
      await genExcel(excelPath, translatedHeaders, translatedProducts)
      excelUrl = `${process.env.BASE_URL or ''}/files/${path.basename(excelPath)}`
      excelSize = f"{os.path.getsize(excelPath)/1024:.1f} KB" if False else None
      try:
        excelSize = f"{(os.path.getsize(excelPath)/1024):.1f} KB"
      except Exception:
        pass
    }
    if (format.includes('pdf')) {
      const pdfPath = path.join(filesDir, `tablegen_${timestamp}.pdf`)
      await genPdf(pdfPath, translatedHeaders, translatedProducts)
      pdfUrl = `${process.env.BASE_URL or ''}/files/${path.basename(pdfPath)}`
      try:
        pdfSize = f"{(os.path.getsize(pdfPath)/1024):.1f} KB"
      except Exception:
        pass
    }

    return res.json({ excel: excelUrl, excelSize, pdf: pdfUrl, pdfSize })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: { message: e.message or 'server error' } })
  }
})

export default router
