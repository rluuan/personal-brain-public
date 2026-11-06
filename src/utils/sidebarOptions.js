import {
  Folder, Briefcase, BookOpen, Star, Heart, Lightbulb, Code,
  GraduationCap, Rocket, Palette, Music, Camera, Coffee, Home, Archive, Wallet,
} from 'lucide-react'

export const FOLDER_COLORS = [
  '#f38ba8', '#fab387', '#f9e2af', '#a6e3a1',
  '#89b4fa', '#cba6f7', '#f5c2e7', 'var(--color-muted-2)',
]

export const FOLDER_ICONS = {
  Folder, Briefcase, BookOpen, Star, Heart, Lightbulb, Code,
  GraduationCap, Rocket, Palette, Music, Camera, Coffee, Home, Archive, Wallet,
}

export const FOLDER_ICON_NAMES = Object.keys(FOLDER_ICONS)

export const STATUS_OPTIONS = [
  { id: 'ativo',       label: 'Ativo',       color: '#a6e3a1' },
  { id: 'em_espera',   label: 'Em Espera',   color: '#f9e2af' },
  { id: 'concluido',   label: 'Concluído',   color: '#89b4fa' },
  { id: 'abandonado',  label: 'Abandonado',  color: '#f38ba8' },
]

export function getStatusInfo(statusId, statusList = STATUS_OPTIONS) {
  return statusList.find((s) => s.id === statusId) || null
}

const DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g')

export function slugifyStatus(label) {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `status_${Date.now()}`
}
