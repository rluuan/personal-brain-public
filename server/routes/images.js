import express from 'express'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'

const router = express.Router()

function getImagesDir() {
  const base = process.env.CONFIG_PATH
    ? path.dirname(process.env.CONFIG_PATH)
    : path.join(process.cwd(), 'data')
  const dir = path.join(base, 'images')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// POST /api/images/upload — multipart/form-data, field "image"
router.post('/images/upload', (req, res) => {
  const contentType = req.headers['content-type'] || ''
  if (!contentType.includes('multipart/form-data')) {
    return res.status(400).json({ error: 'esperado multipart/form-data' })
  }

  const boundary = contentType.split('boundary=')[1]
  if (!boundary) return res.status(400).json({ error: 'boundary ausente' })

  const chunks = []
  req.on('data', (chunk) => chunks.push(chunk))
  req.on('end', () => {
    try {
      const buf = Buffer.concat(chunks)
      const raw = buf.toString('binary')

      // Extract filename field
      const nameMatch = raw.match(/name="filename"\r\n\r\n([^\r\n]+)/)
      const filename = nameMatch ? nameMatch[1] : `img-${Date.now()}.bin`

      // Extract image binary
      const imgHeaderEnd = raw.indexOf('\r\n\r\n', raw.indexOf('name="image"')) + 4
      const boundaryEnd = raw.lastIndexOf(`--${boundary}`)
      const imgBinary = raw.slice(imgHeaderEnd, boundaryEnd - 2) // strip trailing \r\n

      const dir = getImagesDir()
      const filePath = path.join(dir, filename)
      fs.writeFileSync(filePath, Buffer.from(imgBinary, 'binary'))

      res.json({ url: `/uploads/${filename}` })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })
  req.on('error', (e) => res.status(500).json({ error: e.message }))
})

// POST /api/images — legacy JSON base64
router.post('/images', (req, res) => {
  try {
    const { dataUrl, filename } = req.body
    if (!dataUrl || !dataUrl.startsWith('data:')) return res.status(400).json({ error: 'dataUrl inválido' })

    const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!match) return res.status(400).json({ error: 'formato não suportado' })

    const [, ext, base64] = match
    const dir = getImagesDir()
    const name = filename || `img-${Date.now()}.${ext}`
    fs.writeFileSync(path.join(dir, name), Buffer.from(base64, 'base64'))

    res.json({ url: `/uploads/${name}` })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export { router as imageRoutes, getImagesDir }
