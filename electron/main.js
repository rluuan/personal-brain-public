import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// User data: banco e config ficam em AppData, persistem entre atualizações
const userData   = app.getPath('userData')
const configPath = path.join(userData, 'db-config.json')
const staticDir  = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist')
  : path.join(__dirname, '..', 'dist')

// Criar config inicial apontando para userData se ainda não existir
if (!fs.existsSync(configPath)) {
  fs.mkdirSync(userData, { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify({
    dbType: 'sqlite',
    sqliteFile: path.join(userData, 'brain.db'),
  }, null, 2))
}

process.env.CONFIG_PATH  = configPath
process.env.STATIC_DIR   = staticDir
process.env.APP_VERSION  = app.getVersion()

// Iniciar servidor Express inline (mesmo processo)
const { startServer } = await import('../server/index.js')
await startServer({ staticDir })

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../public/favicon.png'),
    title: 'Personal Brain',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.loadURL('http://localhost:3001')

  // Abrir links externos no browser do sistema, não no Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

app.whenReady().then(async () => {
  const win = createWindow()

  if (app.isPackaged) {
    const { autoUpdater } = await import('electron-updater')
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', (info) => {
      win.webContents.send('update-available', info)
    })

    autoUpdater.on('download-progress', (info) => {
      win.webContents.send('download-progress', info)
    })

    autoUpdater.on('update-downloaded', (info) => {
      win.webContents.send('update-downloaded', info)
    })

    ipcMain.on('install-update', () => {
      autoUpdater.quitAndInstall()
    })

    autoUpdater.checkForUpdates().catch(() => {})
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
