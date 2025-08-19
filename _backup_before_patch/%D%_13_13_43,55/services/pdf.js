import PDFDocument from 'pdfkit'
import fs from 'fs'
import https from 'https'
import http from 'http'

async function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    mod.get(url, (resp) => {
      const data = []
      resp.on('data', (chunk) => data.push(chunk))
      resp.on('end', () => resolve(Buffer.concat(data)))
    }).on('error', reject)
  })
}

export async function genPdf(filePath, headers, rows) {
  const doc = new PDFDocument({ size: 'A4', margins: { top:36, bottom:36, left:36, right:36 } })
  const stream = fs.createWriteStream(filePath)
  doc.pipe(stream)

  const col = 3
  const gap = 20
  const cardW = (doc.page.width - doc.page.margins.left - doc.page.margins.right - gap*(col-1)) / col
  const cardH = 240

  let x = doc.page.margins.left
  let y = doc.page.margins.top

  for (const r of rows) {
    doc.rect(x, y, cardW, cardH).strokeColor('#ddd').stroke()
    let curY = y + 10

    if (r.imageUrl) {
      try {
        const buf = await fetchBuffer(r.imageUrl)
        doc.image(buf, x+10, curY, { width: 150, height: 150 })
      } catch (e) {}
    }

    doc.font('Helvetica-Bold').fontSize(12).text(r.name || 'N/A', x+170, curY, { width: cardW-180 })
    curY += 18
    doc.font('Helvetica').fontSize(10).text(`Price: ${r.price ?? ''}`, x+170, curY)
    curY += 14
    doc.text(`MOQ: ${r.moq_value ?? ''}`, x+170, curY)
    curY += 14
    doc.text((r.description || '').slice(0, 160), x+10, y+170, { width: cardW-20 })

    x += cardW + gap
    if (x + cardW > doc.page.width - doc.page.margins.right) {
      x = doc.page.margins.left
      y += cardH + gap
      if (y + cardH > doc.page.height - doc.page.margins.bottom) {
        doc.addPage()
        y = doc.page.margins.top
      }
    }
  }

  doc.end()
  await new Promise(res => stream.on('finish', res))
}
