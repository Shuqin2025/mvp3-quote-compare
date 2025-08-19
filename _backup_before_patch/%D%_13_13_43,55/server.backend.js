import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import tablegenRouter from './routes/tablegen.js'

dotenv.config()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json({limit:'2mb'}))

// serve generated files
app.use('/files', express.static(path.join(__dirname, 'files')))

app.use('/v1/api', tablegenRouter)

const port = process.env.PORT || 5174
app.listen(port, () => console.log(`[tablegen-backend] listening on :${port}`))
