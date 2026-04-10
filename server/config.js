import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_FILE = process.env.CONFIG_PATH || path.join(__dirname, '..', 'db-config.json')

const DEFAULT_CONFIG = {
  dbType: 'sqlite',
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT) || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  database: process.env.PG_DB || 'postgres',
  sqliteFile: './brain.db'
}

let config = loadConfigFromDisk()

function loadConfigFromDisk() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }
    } catch (e) {
      console.warn('[Config] Erro ao carregar db-config.json, usando padrão.')
    }
  } else {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2))
  }
  return DEFAULT_CONFIG
}

export function loadConfig() {
  return config
}

export function saveConfig(cfg) {
  config = cfg
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2))
}

export function getConfig() {
  return config
}

export function setConfig(newCfg) {
  config = newCfg
}
