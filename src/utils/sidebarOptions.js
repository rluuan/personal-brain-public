import {
  Folder, Briefcase, BookOpen, Star, Heart, Lightbulb, Code,
  GraduationCap, Rocket, Palette, Music, Camera, Coffee, Home, Archive, Wallet,
} from 'lucide-react'

export const FOLDER_COLORS = [
  '#f38ba8', '#fab387', '#f9e2af', '#a6e3a1',
  '#89b4fa', '#cba6f7', '#f5c2e7', '#a6adc8',
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

export function getStatusInfo(statusId) {
  return STATUS_OPTIONS.find((s) => s.id === statusId) || null
}
