import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_HISTORY = 6

// ── Model routing ─────────────────────────────────────────────────────────────
const MODELS = {
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus:   'claude-opus-4-8',
} as const

// Cost per million tokens (input / cacheWrite / cacheRead / output)
const RATES: Record<string, [number, number, number, number]> = {
  [MODELS.haiku]:  [0.80,  1.00, 0.08,  4.00],
  [MODELS.sonnet]: [3.00,  3.75, 0.30, 15.00],
  [MODELS.opus]:   [15.00, 18.75, 1.50, 75.00],
}

function selectModel(question: string): string {
  const q = question.toLowerCase()
  if (/relatório formal|plano de intervenção|plano individualizado|análise aprofundada|diagnóstico completo/.test(q))
    return MODELS.opus
  if (/compare|compara|evolução|correlacione|analise|tendência|histórico|ranking|diferença entre/.test(q))
    return MODELS.sonnet
  return MODELS.haiku
}

function calcCost(model: string, usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number }): number {
  const [rIn, rCacheWrite, rCacheRead, rOut] = RATES[model] ?? RATES[MODELS.haiku]
  const cost =
    (usage.input_tokens * rIn +
    (usage.cache_creation_input_tokens ?? 0) * rCacheWrite +
    (usage.cache_read_input_tokens ?? 0) * rCacheRead +
    usage.output_tokens * rOut) / 1_000_000
  return Math.round(cost * 10000) / 10000 // 4 decimal places
}

async function buildSchoolContext() {
  const [
    classes,
    students,
    homework,
    classRecords,
    pedagogicalRecords,
    saebPerformances,
    enemPerformances,
  ] = await Promise.all([
    prisma.class.findMany({
      include: { teacherClasses: { include: { teacher: { include: { user: true } }, subject: true } } }
    }),
    prisma.student.findMany({
      select: {
        id: true, name: true, status: true,
        class: { select: { name: true } },
        gradeRecords: { select: { score: true, assessment: { select: { name: true, subject: { select: { name: true } } } } } },
        homeworkSubmissions: { select: { homeworkId: true } },
        saebPerformances: { select: { score: true, level: true, descriptor: { select: { code: true } } } },
        enemPerformances: { select: { score: true, competency: { select: { code: true } } } },
        pedagogicalRecords: { select: { type: true, title: true, resolved: true }, where: { confidentiality: { not: 'CONFIDENCIAL' } } },
      }
    }),
    prisma.homework.findMany({
      select: {
        title: true, classId: true,
        subject: { select: { name: true } },
        class: { select: { name: true } },
        dueDate: true,
        _count: { select: { submissions: true } },
      }
    }),
    prisma.classRecord.findMany({
      select: { date: true, contentDeveloped: true, pending: true, class: { select: { name: true } }, subject: { select: { name: true } }, teacher: { select: { user: { select: { name: true } } } } },
      orderBy: { date: 'desc' }, take: 20,
    }),
    prisma.pedagogicalRecord.findMany({
      where: { confidentiality: { not: 'CONFIDENCIAL' } },
      select: { type: true, title: true, date: true, resolved: true, student: { select: { name: true, class: { select: { name: true } } } } },
      orderBy: { date: 'desc' }, take: 20,
    }),
    prisma.studentSaebPerformance.findMany({ select: { score: true, level: true, descriptor: { select: { code: true, description: true, area: true } }, student: { select: { name: true, class: { select: { name: true } } } } } }),
    prisma.studentEnemPerformance.findMany({ select: { score: true, competency: { select: { code: true, description: true, area: true } }, student: { select: { name: true } } } }),
  ])

  const avg = (arr: number[]) => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null

  // SAEB summary by descriptor
  const saebMap: Record<string, { desc: string; area: string; scores: number[]; ok: number; bas: number; baixo: number }> = {}
  for (const p of saebPerformances) {
    const k = p.descriptor.code
    if (!saebMap[k]) saebMap[k] = { desc: p.descriptor.description, area: p.descriptor.area, scores: [], ok: 0, bas: 0, baixo: 0 }
    saebMap[k].scores.push(p.score)
    if (p.level === 'ADEQUADO') saebMap[k].ok++
    else if (p.level === 'BASICO') saebMap[k].bas++
    else saebMap[k].baixo++
  }

  // ENEM summary by competency
  const enemMap: Record<string, { desc: string; area: string; scores: number[] }> = {}
  for (const p of enemPerformances) {
    const k = p.competency.code
    if (!enemMap[k]) enemMap[k] = { desc: p.competency.description, area: p.competency.area, scores: [] }
    enemMap[k].scores.push(p.score)
  }

  const classSizes: Record<string, number> = {}
  for (const s of students) if (s.class) classSizes[s.class.name] = (classSizes[s.class.name] || 0) + 1

  return {
    turmas: classes.map(c => ({
      nome: c.name, turno: c.shift, alunos: classSizes[c.name] || 0,
      professores: c.teacherClasses.map(tc => `${tc.teacher.user.name}/${tc.subject.name}`),
    })),
    alunos: students.map(s => ({
      nome: s.name, turma: s.class?.name, status: s.status,
      notas: s.gradeRecords.map(g => `${g.assessment.subject.name}:${g.score ?? '-'}`),
      tarefas: s.homeworkSubmissions.length,
      saeb: s.saebPerformances.length ? s.saebPerformances.map(p => `${p.descriptor.code}:${p.score}(${p.level.slice(0,3)})`).join(' ') : null,
      enem: s.enemPerformances.length ? s.enemPerformances.map(p => `${p.competency.code}:${p.score}`).join(' ') : null,
      ocorrencias: s.pedagogicalRecords.length ? s.pedagogicalRecords.map(p => `${p.type}:${p.title}`).join('; ') : null,
    })),
    tarefas: homework.map(hw => ({
      titulo: hw.title, componente: hw.subject.name, turma: hw.class.name,
      prazo: hw.dueDate?.toLocaleDateString('pt-BR'),
      entregues: hw._count.submissions,
      total: classSizes[hw.class.name] || 0,
    })),
    registrosAula: classRecords.map(r => ({
      data: r.date.toLocaleDateString('pt-BR'), turma: r.class.name,
      componente: r.subject?.name, professor: r.teacher.user.name,
      conteudo: r.contentDeveloped.slice(0, 120),
    })),
    saeb: Object.entries(saebMap).map(([code, d]) => ({
      code, desc: d.desc, area: d.area, media: avg(d.scores),
      adequado: d.ok, basico: d.bas, abaixoBasico: d.baixo,
    })),
    enem: Object.entries(enemMap).map(([code, d]) => ({
      code, desc: d.desc, area: d.area, media: avg(d.scores),
    })),
    alertas: pedagogicalRecords.map(pr => ({
      aluno: pr.student.name, turma: pr.student.class?.name,
      tipo: pr.type, titulo: pr.title,
      data: pr.date.toLocaleDateString('pt-BR'), resolvido: pr.resolved,
    })),
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada. Adicione a chave no .env e reinicie o servidor.' },
      { status: 503 }
    )
  }

  const { messages } = await req.json()
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages array required' }, { status: 400 })
  }

  const schoolData = await buildSchoolContext()

  const systemPrompt = `Você é o Assistente Pedagógico Arcadia — especializado em análise de dados educacionais.

DADOS DA ESCOLA (${new Date().toLocaleDateString('pt-BR')}):
${JSON.stringify(schoolData)}

REGRAS:
- Responda em português brasileiro, de forma objetiva e pedagógica
- Use markdown: tabelas para comparações, listas para itens, **negrito** para destaques
- Níveis SAEB: ADEQUADO≥7, BASICO 5–6.9, ABAIXO_BASICO<5 (abreviado ADE/BAS/ABA)
- ENEM: escala 0–1000, média nacional ~550
- Sinalize riscos com clareza. Nunca invente dados.`

  const recentMessages = messages.slice(-MAX_HISTORY)
  const lastUserMessage = [...recentMessages].reverse().find(m => m.role === 'user')?.content ?? ''
  const model = selectModel(lastUserMessage)

  const response = await client.messages.create({
    model,
    max_tokens: 1500,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        // @ts-expect-error cache_control is supported but not yet in SDK types
        cache_control: { type: 'ephemeral' },
      }
    ],
    messages: recentMessages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cost = calcCost(model, response.usage as Parameters<typeof calcCost>[1])
  const modelLabel = model === MODELS.opus ? 'Opus' : model === MODELS.sonnet ? 'Sonnet' : 'Haiku'

  return NextResponse.json({ message: text, model: modelLabel, cost })
}
