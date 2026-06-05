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
  const avg = (arr: number[]) => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null
  const pct = (n: number, t: number) => t ? Math.round(n / t * 100) : 0

  const schools = await prisma.school.findMany({ include: { classes: true } })

  // Per-school aggregated data — no per-student rows
  const escolas = await Promise.all(schools.map(async school => {
    const classIds = school.classes.map(c => c.id)

    const [totalAlunos, gradeRows, saebRows, pedCounts, pedRecent] = await Promise.all([
      prisma.student.count({ where: { classId: { in: classIds } } }),
      prisma.gradeRecord.findMany({
        where: { assessment: { classId: { in: classIds } } },
        select: { score: true, assessment: { select: { subject: { select: { name: true } } } } },
      }),
      prisma.studentSaebPerformance.findMany({
        where: { student: { classId: { in: classIds } } },
        select: { score: true, level: true, descriptor: { select: { code: true, description: true, area: true } } },
      }),
      // Count by type for family/at-risk pipeline
      Promise.all(['OBSERVACAO','REUNIAO','BUSCA_ATIVA','ATENDIMENTO','ADVERTENCIA'].map(async tipo => ({
        tipo,
        total: await prisma.pedagogicalRecord.count({ where: { student: { classId: { in: classIds } }, type: tipo } }),
        abertos: await prisma.pedagogicalRecord.count({ where: { student: { classId: { in: classIds } }, type: tipo, resolved: false } }),
      }))),
      prisma.pedagogicalRecord.findMany({
        where: { student: { classId: { in: classIds } }, resolved: false, confidentiality: { not: 'CONFIDENCIAL' } },
        orderBy: { date: 'desc' }, take: 8,
        select: { type: true, title: true, date: true, actionPlan: true, student: { select: { name: true, class: { select: { name: true } } } } },
      }),
    ])

    // Grade stats
    const allScores = gradeRows.map(g => g.score).filter(Boolean) as number[]
    const belowAvg = allScores.filter(s => s < 5).length

    // SAEB per descriptor
    const saebMap: Record<string, { desc: string; area: string; scores: number[]; ok: number; bas: number; baixo: number }> = {}
    for (const p of saebRows) {
      if (!saebMap[p.descriptor.code]) saebMap[p.descriptor.code] = { desc: p.descriptor.description, area: p.descriptor.area, scores: [], ok: 0, bas: 0, baixo: 0 }
      saebMap[p.descriptor.code].scores.push(p.score)
      if (p.level === 'ADEQUADO') saebMap[p.descriptor.code].ok++
      else if (p.level === 'BASICO') saebMap[p.descriptor.code].bas++
      else saebMap[p.descriptor.code].baixo++
    }

    const [teachersAll, teachersWithRecords] = await Promise.all([
      prisma.teacherClass.findMany({
        where: { classId: { in: classIds } },
        distinct: ['teacherId'],
        select: {
          teacher: { select: { id: true, user: { select: { name: true } }, classRecords: { select: { id: true } } } },
          subject: { select: { name: true } },
        },
      }),
      prisma.classRecord.groupBy({
        by: ['teacherId'],
        where: { classId: { in: classIds } },
        _count: { id: true },
      }),
    ])

    const recordCountByTeacher = Object.fromEntries(teachersWithRecords.map(r => [r.teacherId, r._count.id]))

    const teacherCoverage = teachersAll.map(tc => ({
      nome: tc.teacher.user.name,
      disciplina: tc.subject.name,
      totalRegistros: recordCountByTeacher[tc.teacher.id] ?? 0,
    }))

    const professoresSemRegistro = teacherCoverage.filter(t => t.totalRegistros === 0)
    const professoresComRegistro = teacherCoverage.filter(t => t.totalRegistros > 0)

    return {
      escola: school.name,
      cidade: school.address?.split(',')[1]?.trim().split('-')[0]?.trim() ?? '',
      totalAlunos,
      totalTurmas: school.classes.length,
      coberturaDiarios: {
        totalProfessores: teacherCoverage.length,
        comRegistro: professoresComRegistro.length,
        semRegistro: professoresSemRegistro.length,
        professoresSemRegistro,
        professoresComRegistro: professoresComRegistro.map(t => ({ nome: t.nome, disciplina: t.disciplina, totalRegistros: t.totalRegistros })),
      },
      desempenho: {
        mediaGeral: avg(allScores),
        abaixoMedia: belowAvg,
        pctAbaixoMedia: pct(belowAvg, allScores.length),
      },
      saeb9Ano: Object.entries(saebMap).map(([code, d]) => {
        const total = d.ok + d.bas + d.baixo
        return {
          codigo: code, descricao: d.desc.slice(0, 55), area: d.area,
          media: avg(d.scores),
          adequado: pct(d.ok, total),
          basico: pct(d.bas, total),
          abaixoBasico: pct(d.baixo, total),
        }
      }),
      acompanhamentoPedagogico: {
        totaisPorTipo: pedCounts,
        casosAbertosRecentes: pedRecent.map(p => ({
          aluno: p.student.name, turma: p.student.class?.name,
          tipo: p.type, titulo: p.title.slice(0, 70),
          data: p.date.toLocaleDateString('pt-BR'),
          plano: p.actionPlan?.slice(0, 80),
        })),
      },
    }
  }))

  // Recent class records across all schools (last 15)
  const registrosRecentes = await prisma.classRecord.findMany({
    orderBy: { date: 'desc' }, take: 15,
    select: {
      date: true, contentDeveloped: true, pending: true, observations: true,
      class: { select: { name: true, school: { select: { name: true } } } },
      subject: { select: { name: true } },
      teacher: { select: { user: { select: { name: true } } } },
    },
  })

  return {
    dataConsulta: new Date().toLocaleDateString('pt-BR'),
    escolas,
    registrosAulaRecentes: registrosRecentes.map(r => ({
      data: r.date.toLocaleDateString('pt-BR'),
      escola: r.class.school?.name,
      turma: r.class.name,
      componente: r.subject?.name,
      professor: r.teacher.user.name,
      conteudo: r.contentDeveloped.slice(0, 160),
      pendencias: r.pending?.slice(0, 120) ?? null,
      observacoes: r.observations?.slice(0, 120) ?? null,
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

  const systemPrompt = `Você é o Assistente Pedagógico Vela — especializado em análise de dados educacionais para secretarias e gestores escolares.

CONTEXTO DO SISTEMA (${new Date().toLocaleDateString('pt-BR')}):
${JSON.stringify(schoolData, null, 0)}

INSTRUÇÕES:
- Responda em português brasileiro, de forma objetiva e direta
- **Responda exatamente o que foi perguntado** — não adicione seções ou listas não solicitadas
- Use markdown: tabelas para comparações, listas para itens, **negrito** para indicadores críticos
- Níveis SAEB: adequado ≥70% | básico 50–69% | abaixo do básico <50% (use os percentuais do JSON)
- Os dados de desempenho (saeb9Ano) se referem ao 9º ano — série avaliada pelo SAEB/IDEB
- acompanhamentoPedagogico.totaisPorTipo mostra o pipeline familiar: OBSERVACAO → REUNIAO → BUSCA_ATIVA
- coberturaDiarios contém dados EXATOS e COMPLETOS de quem entregou ou não registros de aula:
  - professoresSemRegistro = lista definitiva dos que NUNCA entregaram nenhum registro
  - professoresComRegistro = lista definitiva dos que já entregaram ao menos um
  - Use SEMPRE esses campos ao responder perguntas sobre diários/registros — NUNCA infira a partir de registrosAulaRecentes
- registrosAulaRecentes contém apenas os últimos 15 registros — use apenas para conteúdo/pendências, NUNCA para inferir cobertura
- Se um dado específico não estiver no contexto, diga isso em uma linha — NUNCA fabrique ou infira dados
- Nunca invente dados. Se um campo for null ou ausente, diga explicitamente.`

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
  // Cast to any to read cache token fields not yet in SDK types
  const u = response.usage as any
  const cost = calcCost(model, {
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
  })
  const modelLabel = model === MODELS.opus ? 'Opus' : model === MODELS.sonnet ? 'Sonnet' : 'Haiku'

  return NextResponse.json({ message: text, model: modelLabel, cost })
}
