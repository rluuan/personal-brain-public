import { app, BrowserWindow, shell } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// User data: banco e config ficam em AppData, persistem entre atualizações
const userData   = app.getPath('userData')
const configPath = path.join(userData, 'db-config.json')
const staticDir  = path.join(__dirname, '..', 'dist')

// Criar config inicial apontando para userData se ainda não existir
if (!fs.existsSync(configPath)) {
  fs.mkdirSync(userData, { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify({
    dbType: 'sqlite',
    sqliteFile: path.join(userData, 'brain.db'),
  }, null, 2))
}

process.env.CONFIG_PATH = configPath
process.env.STATIC_DIR  = staticDir

// Iniciar servidor Express inline (mesmo processo)
const { startServer } = await import('../server/index.js')
await startServer()

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../public/favicon.png'),
    title: 'UAN Brain',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.loadURL('http://localhost:3001')

  // Abrir links externos no browser do sistema, não no Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
