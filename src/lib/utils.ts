import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleString('pt-BR')
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  DIRETOR: 'Diretor',
  COORDENACAO: 'Coordenação',
  PEDAGOGO: 'Pedagogo',
  SECRETARIO: 'Secretário',
  PROFESSOR: 'Professor',
  VISUALIZACAO: 'Visualização',
}

export const STAFF_ROLES = ['PROFESSOR', 'PEDAGOGO', 'SECRETARIO'] as const
export type StaffRole = typeof STAFF_ROLES[number]

export const STATUS_LABELS: Record<string, string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  TRANSFERIDO: 'Transferido',
  FORMADO: 'Formado',
  SUSPENSO: 'Suspenso',
}

export const HOMEWORK_STATUS_LABELS: Record<string, string> = {
  PENDENTE: 'Pendente',
  ENVIADA: 'Enviada',
  CONCLUIDA: 'Concluída',
  ATRASADA: 'Atrasada',
  NAO_REALIZADA: 'Não realizada',
}

export const ASSESSMENT_TYPE_LABELS: Record<string, string> = {
  PROVA: 'Prova',
  TRABALHO: 'Trabalho',
  SEMINARIO: 'Seminário',
  PROJETO: 'Projeto',
  PARTICIPACAO: 'Participação',
  RECUPERACAO: 'Recuperação',
  OUTRO: 'Outro',
}

export const PEDAGOGICAL_RECORD_TYPE_LABELS: Record<string, string> = {
  REUNIAO: 'Reunião',
  ADVERTENCIA: 'Advertência',
  ATENDIMENTO: 'Atendimento',
  ENCAMINHAMENTO: 'Encaminhamento',
  OBSERVACAO: 'Observação',
  ACOMPANHAMENTO_FAMILIAR: 'Acompanhamento Familiar',
  OCORRENCIA: 'Ocorrência',
  PLANO_DE_ACAO: 'Plano de Ação',
}

export function getEmbedUrl(url: string): string | null {
  if (!url) return null
  // YouTube
  const ytRegex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/
  const ytMatch = url.match(ytRegex)
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`
  // Vimeo
  const vimeoRegex = /vimeo\.com\/(\d+)/
  const vimeoMatch = url.match(vimeoRegex)
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`
  // Already an embed URL
  if (url.includes('/embed/')) return url
  return null
}
