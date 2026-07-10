// ─── Menções estruturadas em texto livre ─────────────────────────────────────
// Formato do token gravado no banco: @[Nome Completo|tipo:id]
//   ex.: "Hoje o @[Isadora Campos|aluno:clx3k9a] deu problema na aula."
//
// O token carrega o id real — a resolução para a IA é determinística
// (id → alias, sem heurística de nome), e a exibição vira um chip com o nome.
// Este módulo é isomórfico (client + server): sem Prisma, sem Node APIs.

export type MentionType = 'aluno' | 'professor' | 'usuario'

export interface Mention {
  name: string
  type: MentionType
  id: string
  token: string
}

export const MENTION_RE = /@\[([^\]|]+)\|(aluno|professor|usuario):([A-Za-z0-9]+)\]/g

export function makeMentionToken(name: string, type: MentionType, id: string): string {
  // '|' e ']' não podem aparecer no nome para não quebrar o token
  return `@[${name.replace(/[|\]]/g, ' ').trim()}|${type}:${id}]`
}

export function extractMentions(text: string): Mention[] {
  const out: Mention[] = []
  for (const m of Array.from(text.matchAll(new RegExp(MENTION_RE.source, 'g')))) {
    out.push({ name: m[1], type: m[2] as MentionType, id: m[3], token: m[0] })
  }
  return out
}

// Exibição em contextos de texto puro (server components, previews, buscas)
export function mentionsToPlainText(text: string): string {
  if (!text) return text
  return text.replace(new RegExp(MENTION_RE.source, 'g'), '$1')
}

// Divide o texto em segmentos para renderização com chips no client
export type MentionSegment =
  | { kind: 'text'; value: string }
  | { kind: 'mention'; mention: Mention }

export function segmentMentions(text: string): MentionSegment[] {
  if (!text) return []
  const segments: MentionSegment[] = []
  const re = new RegExp(MENTION_RE.source, 'g')
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', value: text.slice(last, m.index) })
    segments.push({
      kind: 'mention',
      mention: { name: m[1], type: m[2] as MentionType, id: m[3], token: m[0] },
    })
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) })
  return segments
}
