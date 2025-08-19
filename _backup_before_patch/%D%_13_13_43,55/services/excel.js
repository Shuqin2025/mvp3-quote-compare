import ExcelJS from 'exceljs'
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

export async function genExcel(filePath, headers, rows) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Table')
  ws.getRow(1).font = { bold: true }
  const hasImage = headers.includes('imageUrl')

  const displayHeaders = headers.slice()
  const colKeys = headers.slice()

  if (hasImage && !displayHeaders.includes('image')) {
    displayHeaders.unshift('image')
    colKeys.unshift('imageUrl')
  }
  ws.columns = displayHeaders.map(h => ({ header: h, key: h, width: 20 }))

  let rowIndex = 2
  for (const r of rows) {
    const rowValues = []
    for (const key of colKeys) {
      if (key !== 'imageUrl') rowValues.push(r[key] ?? '')
    }
    if (colKeys[0] === 'imageUrl') rowValues.unshift('')
    ws.addRow(rowValues)

    if (colKeys[0] === 'imageUrl' && r.imageUrl) {
      try {
        const buf = await fetchBuffer(r.imageUrl)
        const imgId = wb.addImage({ buffer: buf, extension: 'png' })
        ws.addImage(imgId, {
          tl: { col: 0, row: rowIndex-1 },
          ext: { width: 150, height: 150 }
        })
        ws.getRow(rowIndex).height = 100
      } catch (e) {}
    }
    rowIndex++
  }
  await wb.xlsx.writeFile(filePath)
}
