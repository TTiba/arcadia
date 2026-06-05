import Anthropic from '@anthropic-ai/sdk'
import { prisma } from './prisma'
import { DashboardWidget, DashboardConfig } from './dashboard-engine'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlockRef {
  blockId: string
  params?: Record<string, string | number>
}

export interface CompactDashboardConfig {
  title: string
  description?: string
  blocks: BlockRef[]
}

export interface Block {
  name: string
  description: string
  paramDocs?: string
  widgets: Array<Omit<DashboardWidget, 'id' | 'params'>>
}

// ─── Static Block Library ─────────────────────────────────────────────────────
// These blocks ship with the platform. The AI can also create new ones on demand
// (saved to DashboardBlock in the DB) which grow the catalog over time.

export const BLOCK_LIBRARY: Record<string, Block> = {
  class_total: {
    name: 'Total de Alunos',
    description: 'Número total de alunos matriculados. Params: classId',
    widgets: [
      { type: 'METRIC', title: 'Total de Alunos', dataKey: 'total_alunos', size: 'sm' },
    ],
  },

  saeb_overview: {
    name: 'Visão Geral SAEB',
    description: 'Média geral + distribuição Adequado/Básico/Abaixo no SAEB. Params: area, classId',
    widgets: [
      { type: 'METRIC', title: 'Média SAEB', dataKey: 'saeb_media_geral', size: 'sm' },
      { type: 'PROGRESS_BARS', title: 'Distribuição de Níveis SAEB', dataKey: 'saeb_nivel_distribuicao', size: 'md' },
    ],
  },

  saeb_descriptor_detail: {
    name: 'Detalhamento por Descritor',
    description: 'Tabela com média por descritor SAEB. Params: area, classId',
    widgets: [
      { type: 'TABLE', title: 'Desempenho por Descritor', dataKey: 'saeb_por_descritor', size: 'lg' },
    ],
  },

  saeb_at_risk: {
    name: 'Alunos Abaixo do Básico (SAEB)',
    description: 'Lista de alunos com nível Abaixo do Básico. Params: area, classId',
    widgets: [
      { type: 'LIST', title: 'Alunos Abaixo do Básico', dataKey: 'saeb_alunos_abaixo', size: 'md' },
    ],
  },

  enem_competency: {
    name: 'Competências ENEM',
    description: 'Tabela com média por competência ENEM. Params: classId',
    widgets: [
      { type: 'TABLE', title: 'Médias por Competência ENEM', dataKey: 'enem_media_por_competencia', size: 'lg' },
    ],
  },

  enem_ranking: {
    name: 'Ranking ENEM',
    description: 'Ranking de alunos por pontuação média ENEM. Params: classId',
    widgets: [
      { type: 'LIST', title: 'Ranking de Alunos — ENEM', dataKey: 'enem_ranking_alunos', size: 'md' },
    ],
  },

  homework_adherence: {
    name: 'Adesão às Tarefas',
    description: 'Barras de progresso de entrega por tarefa. Params: classId, subjectId',
    widgets: [
      { type: 'PROGRESS_BARS', title: 'Adesão às Tarefas de Casa', dataKey: 'tarefas_adesao', size: 'lg' },
    ],
  },

  homework_pending: {
    name: 'Tarefas Pendentes por Aluno',
    description: 'Lista de alunos com tarefas não entregues. Params: classId',
    widgets: [
      { type: 'LIST', title: 'Alunos com Tarefas Pendentes', dataKey: 'tarefas_pendentes', size: 'md' },
    ],
  },

  grade_summary: {
    name: 'Médias por Avaliação',
    description: 'Tabela com média de notas por avaliação/componente. Params: classId, subjectId',
    widgets: [
      { type: 'TABLE', title: 'Médias por Avaliação', dataKey: 'notas_media_turma', size: 'lg' },
    ],
  },

  grade_low: {
    name: 'Alunos com Baixo Desempenho em Notas',
    description: 'Lista de alunos abaixo do threshold de nota. Params: classId, threshold (padrão 5)',
    widgets: [
      { type: 'LIST', title: 'Baixo Desempenho em Avaliações', dataKey: 'notas_alunos_baixo_desempenho', size: 'md' },
    ],
  },

  students_at_risk: {
    name: 'Alunos em Situação de Risco',
    description: 'Score de risco combinado: SAEB + tarefas + registros pedagógicos. Params: classId',
    widgets: [
      { type: 'ALERT_LIST', title: 'Alunos em Situação de Risco', dataKey: 'alunos_risco', size: 'full' },
    ],
  },

  teacher_activity: {
    name: 'Atividade dos Professores',
    description: 'Total de registros de aula por professor',
    widgets: [
      { type: 'LIST', title: 'Registros de Aula por Professor', dataKey: 'atividade_professores', size: 'md' },
    ],
  },

  class_comparison: {
    name: 'Comparativo entre Turmas',
    description: 'Tabela comparando médias de notas e SAEB entre todas as turmas',
    widgets: [
      { type: 'TABLE', title: 'Comparativo entre Turmas', dataKey: 'comparativo_turmas', size: 'full' },
    ],
  },

  pedagogical_summary: {
    name: 'Resumo de Registros Pedagógicos',
    description: 'Distribuição de registros por tipo (advertências, atendimentos, reuniões...)',
    widgets: [
      { type: 'PROGRESS_BARS', title: 'Registros Pedagógicos por Tipo', dataKey: 'registros_pedagogicos', size: 'md' },
    ],
  },

  attendance_overview: {
    name: 'Frequência Escolar',
    description: 'Alunos com faltas acima do limite nos últimos 30 dias. Params: classId, days (padrão 30)',
    widgets: [
      { type: 'ALERT_LIST', title: 'Alunos com Baixa Frequência', dataKey: 'frequencia_turma', size: 'full' },
    ],
  },
}

// ─── Dynamic Block Resolution ─────────────────────────────────────────────────
// Lookup order: 1. static library → 2. DB → 3. AI-generate + save to DB

async function fetchFromDb(blockId: string): Promise<Block | null> {
  const row = await prisma.dashboardBlock.findUnique({ where: { blockId } })
  if (!row) return null
  await prisma.dashboardBlock.update({ where: { blockId }, data: { usageCount: { increment: 1 } } })
  return { name: row.name, description: row.description, widgets: JSON.parse(row.widgets) }
}

const VALID_DATA_KEYS = [
  'saeb_media_geral', 'saeb_nivel_distribuicao', 'saeb_por_descritor', 'saeb_alunos_abaixo',
  'enem_media_por_competencia', 'enem_ranking_alunos',
  'notas_media_turma', 'notas_alunos_baixo_desempenho',
  'tarefas_adesao', 'tarefas_pendentes',
  'registros_pedagogicos', 'alunos_risco', 'atividade_professores',
  'comparativo_turmas', 'total_alunos', 'frequencia_turma',
]

const VALID_TYPES = ['METRIC', 'LIST', 'PROGRESS_BARS', 'TABLE', 'ALERT_LIST']
const VALID_SIZES = ['sm', 'md', 'lg', 'full']

async function generateAndSave(blockId: string): Promise<Block | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Gere a definição de um bloco de dashboard chamado "${blockId}" para um sistema de gestão escolar.

DataKeys disponíveis: ${VALID_DATA_KEYS.join(', ')}
Tipos de widget: ${VALID_TYPES.join(', ')} (METRIC=número único, LIST=lista, PROGRESS_BARS=barras, TABLE=tabela, ALERT_LIST=alertas)
Tamanhos: sm, md, lg, full

Retorne SOMENTE este JSON (sem markdown):
{"name":"Nome legível","description":"Para que serve. Params opcionais: ...","widgets":[{"type":"METRIC","title":"Título","dataKey":"total_alunos","size":"sm"}]}`

  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
    const def = JSON.parse(text)

    // Validate to avoid saving garbage
    if (!def.name || !Array.isArray(def.widgets)) return null
    for (const w of def.widgets) {
      if (!VALID_TYPES.includes(w.type)) return null
      if (!VALID_DATA_KEYS.includes(w.dataKey)) return null
      if (w.size && !VALID_SIZES.includes(w.size)) w.size = 'md'
    }

    await prisma.dashboardBlock.upsert({
      where: { blockId },
      create: { blockId, name: def.name, description: def.description || '', widgets: JSON.stringify(def.widgets) },
      update: { usageCount: { increment: 1 } },
    })

    return { name: def.name, description: def.description || '', widgets: def.widgets }
  } catch {
    return null
  }
}

export async function resolveBlock(blockId: string): Promise<Block | null> {
  return BLOCK_LIBRARY[blockId] ?? await fetchFromDb(blockId) ?? await generateAndSave(blockId)
}

// ─── Expand ───────────────────────────────────────────────────────────────────

export async function expandBlocks(compact: CompactDashboardConfig): Promise<DashboardConfig> {
  const widgets: DashboardWidget[] = []
  let seq = 1

  for (const ref of compact.blocks) {
    const block = await resolveBlock(ref.blockId)
    if (!block) continue
    for (const w of block.widgets) {
      widgets.push({ ...w, id: `w${seq++}`, params: ref.params })
    }
  }

  return { title: compact.title, description: compact.description, widgets }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isCompact(config: unknown): config is CompactDashboardConfig {
  return typeof config === 'object' && config !== null && 'blocks' in config
}

export function buildBlockCatalog(): string {
  return Object.entries(BLOCK_LIBRARY)
    .map(([id, b]) => `- \`${id}\`: ${b.description}`)
    .join('\n')
}
