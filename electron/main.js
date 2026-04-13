import { app, BrowserWindow, shell, ipcMain, session } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import log from 'electron-log'
import pkgUpdater from 'electron-updater'
const { autoUpdater } = pkgUpdater

// Configuração básica do log
log.transports.file.level = 'info'
log.info('================================')
log.info('=== INICIANDO PERSONAL BRAIN ===')
log.info('Versão:', app.getVersion())
log.info('Arquitetura:', process.arch)
log.info('Plataforma:', process.platform)
log.info('Is Packaged:', app.isPackaged)
log.info('================================')

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
      preload: path.join(__dirname, 'preload.cjs'),
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
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') return callback(true)
    callback(false)
  })

  const win = createWindow()

  if (app.isPackaged) {
    log.info('App está empacotado (isPackaged: true). Iniciando auto-updater...')
    
    try {
      // Conecta o autoUpdater ao nosso logger
      autoUpdater.logger = log
      
      log.info('Configurando auto-updater...')
      autoUpdater.autoDownload = true
      autoUpdater.autoInstallOnAppQuit = true

      autoUpdater.on('checking-for-update', () => {
        log.info('Checking for update...')
      })

      autoUpdater.on('update-available', (info) => {
        log.info('Update available. Versão:', info.version)
        win.webContents.send('update-available', info)
      })

      autoUpdater.on('update-not-available', (info) => {
        log.info('Update not available.')
      })

      autoUpdater.on('error', (err) => {
        log.error('Erro reportado pelo auto-updater:', err)
      })

      autoUpdater.on('download-progress', (progressObj) => {
        log.info(`Download em progresso: ${progressObj.percent.toFixed(2)}%`)
        win.webContents.send('download-progress', progressObj)
      })

      autoUpdater.on('update-downloaded', (info) => {
        log.info('Update baixado; será instalado ao fechar o app')
        win.webContents.send('update-downloaded', info)
      })

      ipcMain.on('install-update', () => {
        log.info('Instalando atualização e reiniciando...')
        autoUpdater.quitAndInstall()
      })

      log.info('Chamando checkForUpdates...')
      autoUpdater.checkForUpdates().catch(err => {
        log.error('Erro ao executar checkForUpdates:', err)
      })

      // Verificar atualizações a cada 10 minutos
      setInterval(() => {
        log.info('Verificação periódica de atualização (intervalo de 10 min)...')
        autoUpdater.checkForUpdates().catch(err => {
          log.error('Erro na verificação periódica:', err)
        })
      }, 10 * 60 * 1000)
    } catch (err) {
      log.error('FALHA CRÍTICA AO CARREGAR ELECTRON-UPDATER:', err)
    }
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
