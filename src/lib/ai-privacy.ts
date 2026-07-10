// ─── Privacidade para chamadas de IA ─────────────────────────────────────────
// Fase 1 da arquitetura descrita em docs/arquitetura-ia-privacidade.md:
// pseudônimos estáveis (aluno_8391, professor_015), roster local de nomes e
// scrubber de texto livre. Nenhum nome real, CPF, telefone ou email deve sair
// para a API de IA — e a UI desfaz os aliases na exibição, então a experiência
// do usuário não muda.

import { randomInt } from 'crypto'
import { prisma } from './prisma'

export type EntityType = 'ALUNO' | 'TURMA' | 'ESCOLA' | 'PROFESSOR' | 'USUARIO'

const PREFIX: Record<EntityType, string> = {
  ALUNO: 'aluno',
  TURMA: 'turma',
  ESCOLA: 'escola',
  PROFESSOR: 'professor',
  USUARIO: 'usuario',
}

// ─── Pseudônimos ──────────────────────────────────────────────────────────────

export async function getOrCreateAlias(entityType: EntityType, realId: string): Promise<string> {
  const existing = await prisma.aiPseudonym.findFirst({
    where: { entityType, realId, active: true },
    select: { alias: true },
  })
  if (existing) return existing.alias

  // Alias aleatório (nunca derivado do dado real, nunca sequencial) com
  // checagem de colisão; expande o número de dígitos se o espaço encher.
  for (let digits = 4; digits <= 9; digits++) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const alias = `${PREFIX[entityType]}_${randomInt(10 ** digits).toString().padStart(digits, '0')}`
      try {
        await prisma.aiPseudonym.create({ data: { entityType, realId, alias } })
        return alias
      } catch {
        // colisão no unique — tenta outro número
      }
    }
  }
  throw new Error('Espaço de aliases esgotado')
}

// Resolve aliases de volta para ids reais (só existe localmente)
export async function reverseMap(aliases: string[]): Promise<Map<string, string>> {
  if (aliases.length === 0) return new Map()
  const rows = await prisma.aiPseudonym.findMany({
    where: { alias: { in: aliases }, active: true },
    select: { alias: true, realId: true },
  })
  return new Map(rows.map(r => [r.alias, r.realId]))
}

// Direito de eliminação / resposta a incidente: desativa o alias atual —
// todo histórico externo perde o vínculo com a pessoa.
export async function rotateAlias(entityType: EntityType, realId: string): Promise<string> {
  await prisma.aiPseudonym.updateMany({
    where: { entityType, realId, active: true },
    data: { active: false, rotatedAt: new Date() },
  })
  return getOrCreateAlias(entityType, realId)
}

// ─── Roster: nomes reais do escopo → substituto ──────────────────────────────
// A vantagem estrutural da plataforma: sabemos exatamente quais nomes podem
// aparecer num texto (alunos da turma, responsáveis, corpo docente da escola).

export interface RosterEntry {
  name: string
  replacement: string // alias ("aluno_8391") ou marcador ("[ALUNO]")
}

export interface Roster {
  entries: RosterEntry[]
}

// Monta o roster para as turmas informadas: alunos (com alias), seus
// responsáveis (marcador — responsáveis não precisam de alias estável) e
// o corpo docente da escola (com alias de professor/usuário).
export async function buildRoster(classIds: string[], schoolId?: string | null): Promise<Roster> {
  const [students, guardians, staff] = await Promise.all([
    prisma.student.findMany({
      where: classIds.length ? { classId: { in: classIds } } : { id: '__none__' },
      select: { id: true, name: true },
    }),
    prisma.studentGuardian.findMany({
      where: classIds.length ? { student: { classId: { in: classIds } } } : { id: '__none__' },
      select: { name: true },
    }),
    prisma.user.findMany({
      where: schoolId ? { schoolId } : { id: '__none__' },
      select: { id: true, name: true, teacher: { select: { id: true } } },
    }),
  ])

  const entries: RosterEntry[] = []
  for (const s of students) {
    entries.push({ name: s.name, replacement: await getOrCreateAlias('ALUNO', s.id) })
  }
  for (const g of guardians) {
    entries.push({ name: g.name, replacement: '[RESPONSÁVEL]' })
  }
  for (const u of staff) {
    const alias = u.teacher
      ? await getOrCreateAlias('PROFESSOR', u.teacher.id)
      : await getOrCreateAlias('USUARIO', u.id)
    entries.push({ name: u.name, replacement: alias })
  }
  return { entries }
}

// ─── Scrubber de texto livre ──────────────────────────────────────────────────

const CPF_RE = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g
// Telefone: exige separador ou parênteses para não engolir números soltos (notas, anos)
const PHONE_RE = /(?:\+55\s?)?(?:\(\d{2}\)\s?|\d{2}\s)?\d{4,5}[-.\s]\d{4}\b/g

// Títulos e partículas ignorados ao decompor nomes
const PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
const TITLES_RE = /\b(prof[ªºa]?\.?|profess?or[a]?|dr[a]?\.?|sr[a]?\.?)\s+/gi

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u00aa/g, 'a').replace(/\u00ba/g, 'o').toLowerCase()

// Nomes cadastrados podem vir com t\u00edtulo embutido ("Prof\u00aa. Ana Lu\u00edza Batista")
const stripTitles = (s: string) => s.replace(TITLES_RE, '').replace(/^[\s.,-]+/, '')

// Regex insensível a acentos para um nome (João casa Joao e vice-versa)
const ACCENT_MAP: Record<string, string> = {
  a: '[aáàâãä]', e: '[eéèêë]', i: '[iíìîï]', o: '[oóòôõö]', u: '[uúùûü]', c: '[cç]', n: '[nñ]',
}
function accentInsensitivePattern(name: string): string {
  return normalize(name)
    .split('')
    .map(ch => {
      if (ACCENT_MAP[ch]) return ACCENT_MAP[ch]
      if (/[a-z0-9]/.test(ch)) return ch
      return '\\s+' // espaços e hífens entre partes do nome
    })
    .join('')
}

export function scrubText(text: string, roster: Roster): string {
  if (!text) return text
  let out = text.replace(CPF_RE, '[REDIGIDO]').replace(EMAIL_RE, '[REDIGIDO]').replace(PHONE_RE, '[REDIGIDO]')
  out = out.replace(TITLES_RE, '') // "Profª Ana Luíza" → "Ana Luíza" (o nome é tratado abaixo)

  // 1. Variantes compostas primeiro (nome completo, depois primeiro+último),
  //    das mais longas para as mais curtas — evita substituição parcial.
  type Variant = { pattern: string; length: number; replacement: string }
  const variants: Variant[] = []
  const firstNameCount = new Map<string, number>()

  const decompose = (name: string) =>
    normalize(stripTitles(name)).split(/\s+/).filter(p => p && !PARTICLES.has(p) && p.length > 1)

  for (const entry of roster.entries) {
    const clean = stripTitles(entry.name)
    const parts = decompose(entry.name)
    if (parts.length === 0) continue
    firstNameCount.set(parts[0], (firstNameCount.get(parts[0]) ?? 0) + 1)

    // nome completo (sem título) e todas as janelas de 2+ partes consecutivas:
    // "Ana Luíza Batista" cobre "Ana Luíza", "Luíza Batista" e o nome inteiro
    variants.push({ pattern: accentInsensitivePattern(clean), length: clean.length, replacement: entry.replacement })
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const window = parts.slice(i, j + 1).join(' ')
        variants.push({ pattern: accentInsensitivePattern(window), length: window.length, replacement: entry.replacement })
      }
    }
  }

  variants.sort((a, b) => b.length - a.length)
  for (const v of variants) {
    out = out.replace(new RegExp(`\\b${v.pattern}\\b`, 'gi'), v.replacement)
  }

  // 2. Primeiro nome isolado: se é único no escopo → alias; se ambíguo
  //    (3 Marias na turma) → marcador genérico. Privacidade > fidelidade:
  //    preferimos redigir um "Maria" histórico a vazar um aluno.
  for (const entry of roster.entries) {
    const parts = decompose(entry.name)
    if (parts.length === 0) continue
    const first = parts[0]
    if (first.length < 3) continue // evita falsos positivos com nomes muito curtos
    const unique = firstNameCount.get(first) === 1
    const replacement = unique ? entry.replacement : genericFor(entry.replacement)
    out = out.replace(new RegExp(`\\b${accentInsensitivePattern(first)}\\b`, 'gi'), replacement)
  }

  // 3. Partes soltas de nome (sobrenomes/nomes do meio, ≥4 letras) com inicial
  //    maiúscula — heurística de nome próprio: pega "Batista" solto sem redigir
  //    palavras comuns em minúsculas (ex.: sobrenome "Costa" vs "a costa do PR").
  const seenParts = new Set<string>()
  for (const entry of roster.entries) {
    const parts = decompose(entry.name)
    for (const part of parts.slice(1)) {
      if (part.length < 4 || seenParts.has(part)) continue
      seenParts.add(part)
      const capitalized = accentInsensitivePattern(part).replace(
        /^\[([^\]]+)\]|^([a-z])/,
        (_m, cls, ch) => (cls ? `[${cls.toUpperCase()}${cls}]`.replace(/\[\[/, '[').replace(/\]\]/, ']') : `[${ch.toUpperCase()}${ch}]`)
      )
      out = out.replace(new RegExp(`\\b${capitalized}\\b`, 'g'), genericFor(entry.replacement))
    }
  }

  return out
}

function genericFor(replacement: string): string {
  if (replacement.startsWith('aluno_')) return '[ALUNO]'
  if (replacement.startsWith('professor_') || replacement.startsWith('usuario_')) return '[PROFISSIONAL]'
  return replacement // marcadores ([RESPONSÁVEL]) já são genéricos
}

// ─── Menções estruturadas → alias (resolução determinística) ─────────────────
// Tokens @[Nome|tipo:id] carregam o id real: a troca por alias não depende de
// casamento de nome. Rode ANTES do scrubText — o que o professor marcou com @
// é resolvido com precisão; o scrubber heurístico cobre o que ficou sem marca.

const MENTION_TYPE_TO_ENTITY: Record<string, EntityType> = {
  aluno: 'ALUNO',
  professor: 'PROFESSOR',
  usuario: 'USUARIO',
}

export async function resolveMentionTokens(text: string): Promise<string> {
  if (!text) return text
  const re = /@\[([^\]|]+)\|(aluno|professor|usuario):([A-Za-z0-9]+)\]/g
  const matches = Array.from(text.matchAll(re))
  if (matches.length === 0) return text

  let out = text
  for (const m of matches) {
    const entityType = MENTION_TYPE_TO_ENTITY[m[2]]
    const alias = await getOrCreateAlias(entityType, m[3])
    out = out.split(m[0]).join(alias)
  }
  return out
}

// ─── Remapeamento para exibição ───────────────────────────────────────────────
// A resposta da IA volta com aliases; antes de mostrar ao usuário, trocamos
// pelos nomes reais — localmente. A Anthropic nunca viu os nomes; o usuário
// nunca vê os aliases.

const ALIAS_IN_TEXT_RE = /\b(aluno|turma|escola|professor|usuario)_\d{3,9}\b/g

export async function remapAliasesForDisplay(text: string): Promise<string> {
  const found = Array.from(new Set(text.match(ALIAS_IN_TEXT_RE) ?? []))
  if (found.length === 0) return text

  const realIds = await reverseMap(found)
  const names = new Map<string, string>()

  for (const alias of found) {
    const realId = realIds.get(alias)
    if (!realId) continue
    if (alias.startsWith('aluno_')) {
      const s = await prisma.student.findUnique({ where: { id: realId }, select: { name: true } })
      if (s) names.set(alias, s.name)
    } else if (alias.startsWith('professor_')) {
      const t = await prisma.teacher.findUnique({
        where: { id: realId },
        select: { user: { select: { name: true } } },
      })
      if (t) names.set(alias, t.user.name)
    } else if (alias.startsWith('usuario_')) {
      const u = await prisma.user.findUnique({ where: { id: realId }, select: { name: true } })
      if (u) names.set(alias, u.name)
    } else if (alias.startsWith('turma_')) {
      const c = await prisma.class.findUnique({ where: { id: realId }, select: { name: true } })
      if (c) names.set(alias, c.name)
    } else if (alias.startsWith('escola_')) {
      const e = await prisma.school.findUnique({ where: { id: realId }, select: { name: true } })
      if (e) names.set(alias, e.name)
    }
  }

  let out = text
  names.forEach((name, alias) => {
    out = out.split(alias).join(name)
  })
  return out
}

// Defesa em profundidade: se a resposta da IA contiver padrões de PII,
// algo vazou no prompt — melhor bloquear e investigar do que exibir.
export function containsPiiPatterns(text: string): boolean {
  // regex novas a cada chamada: /g é stateful em .test()
  return /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(text) || /[\w.+-]+@[\w-]+\.[\w.-]+/.test(text)
}
