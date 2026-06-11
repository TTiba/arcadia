import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { ALL_TOOLS, READ_TOOLS, WRITE_TOOL_NAMES, executeReadTool, buildActionSummary } from '@/lib/ai-tools'

// Lazy client — avoids SDK throwing at module load when key is absent
let _client: Anthropic | null = null
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

const MAX_HISTORY = 6
const MAX_TOOL_ROUNDS = 6
const READ_TOOL_NAMES = READ_TOOLS.map(t => t.name)

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

async function buildSchoolContext(role: string, userEmail: string) {
  const avg = (arr: number[]) => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null
  const pct = (n: number, t: number) => t ? Math.round(n / t * 100) : 0

  let schoolWhere = {}
  if (role !== 'ADMIN' && role !== 'DIRETOR') {
    if (userEmail.includes('eeteixeira')) {
      schoolWhere = { name: { contains: 'Anísio Teixeira' } }
    } else if (userEmail.includes('eemlobato')) {
      schoolWhere = { name: { contains: 'Monteiro Lobato' } }
    }
  }

  const schools = await prisma.school.findMany({
    where: schoolWhere,
    include: { classes: true }
  })

  // Per-school aggregated data — no per-student rows
  const escolas = await Promise.all(schools.map(async school => {
    const classIds = school.classes.map(c => c.id)

    const attSince = new Date(); attSince.setDate(attSince.getDate() - 30); attSince.setHours(0,0,0,0)

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

    // Attendance stats (last 30 days)
    const attStudentIds = await prisma.student.findMany({
      where: { classId: { in: classIds }, status: 'ATIVO' },
      select: { id: true },
    }).then(rows => rows.map(r => r.id))

    const attRecords: { studentId: string; status: string }[] = []
    for (let i = 0; i < attStudentIds.length; i += 500) {
      const batch = await prisma.studentAttendance.findMany({
        where: { studentId: { in: attStudentIds.slice(i, i + 500) }, date: { gte: attSince } },
        select: { studentId: true, status: true },
      })
      attRecords.push(...batch)
    }

    const attFaltaMap = new Map<string, number>()
    const attJustMap = new Map<string, number>()
    for (const r of attRecords) {
      if (r.status === 'FALTA') attFaltaMap.set(r.studentId, (attFaltaMap.get(r.studentId) ?? 0) + 1)
      else if (r.status === 'FALTA_JUSTIFICADA') attJustMap.set(r.studentId, (attJustMap.get(r.studentId) ?? 0) + 1)
    }
    const totalFaltas30 = Array.from(attFaltaMap.values()).reduce((a, b) => a + b, 0)
    const alunosEmRiscoFreq = Array.from(attFaltaMap.entries()).filter(([, v]) => v >= 5).length

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
      frequencia30dias: {
        totalFaltasRegistradas: totalFaltas30,
        alunosComMais5Faltas: alunosEmRiscoFreq,
        observacao: alunosEmRiscoFreq === 0
          ? 'Nenhum aluno com frequência crítica nos últimos 30 dias registrados.'
          : `${alunosEmRiscoFreq} aluno(s) com 5+ faltas — risco de reprovação por frequência (mínimo legal: 75%).`,
      },
    }
  }))

  let recordWhere = {}
  if (role !== 'ADMIN' && role !== 'DIRETOR') {
    if (userEmail.includes('eeteixeira')) {
      recordWhere = { class: { school: { name: { contains: 'Anísio Teixeira' } } } }
    } else if (userEmail.includes('eemlobato')) {
      recordWhere = { class: { school: { name: { contains: 'Monteiro Lobato' } } } }
    }
  }

  // Recent class records across all schools (last 15)
  const registrosRecentes = await prisma.classRecord.findMany({
    where: recordWhere,
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

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido no corpo da requisição.' }, { status: 400 })
  }

  const { messages } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages array required' }, { status: 400 })
  }

  let schoolData: any
  try {
    schoolData = await buildSchoolContext((session.user as any).role, session.user?.email || '')
  } catch (err: any) {
    console.error('[AI chat] buildSchoolContext failed:', err)
    return NextResponse.json(
      { error: `Erro ao carregar contexto escolar: ${err?.message ?? 'erro desconhecido'}` },
      { status: 500 }
    )
  }

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
- frequencia30dias contém dados REAIS de chamada dos últimos 30 dias: totalFaltasRegistradas, alunosComMais5Faltas e observacao
  - Professores registram a chamada em /professor/chamada; coordenação e pedagogia veem frequência em /frequencia
  - Se frequencia30dias.totalFaltasRegistradas = 0, significa que a chamada ainda não foi lançada para esse período — informe isso claramente
- Se um dado específico não estiver no contexto, diga isso em uma linha — NUNCA fabrique ou infira dados
- Nunca invente dados. Se um campo for null ou ausente, diga explicitamente.

AÇÕES (cadastros):
- Você pode CADASTRAR no sistema usando ferramentas: membros do corpo docente (professor/pedagogo/secretário), alunos, componentes curriculares e itens de currículo
- Antes de qualquer cadastro, SEMPRE resolva nomes em IDs usando as ferramentas de busca (buscar_turmas, buscar_componentes, buscar_series, buscar_corpo_docente, buscar_alunos)
- Ex: "cadastre o professor João em Ciências nas turmas 7A e 7B" → use buscar_componentes("Ciências") e buscar_turmas("7") para obter os IDs, depois chame criar_membro_docente com os pares turma+componente
- Para professor, monte turmasComponentes (um par classId+subjectId por turma). Para pedagogo/secretário, use turmaIds
- Se faltar uma informação essencial (ex: e-mail do professor), PERGUNTE ao usuário antes de chamar a ferramenta de criação — não invente e-mails ou matrículas
- As ferramentas de criação NÃO gravam imediatamente: o usuário verá um resumo e confirmará. Não diga que já cadastrou — diga que vai preparar a ação para confirmação.`

  const recentMessages = messages.slice(-MAX_HISTORY)
  const lastUserMessage = [...recentMessages].reverse().find(m => m.role === 'user')?.content ?? ''
  const model = selectModel(lastUserMessage)
  const modelLabel = model === MODELS.opus ? 'Opus' : model === MODELS.sonnet ? 'Sonnet' : 'Haiku'

  const systemBlocks = [
    {
      type: 'text' as const,
      text: systemPrompt,
      cache_control: { type: 'ephemeral' as const },
    },
  ]

  const convo: Anthropic.MessageParam[] = recentMessages.map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  let totalCost = 0
  const accCost = (u: any) => {
    totalCost += calcCost(model, {
      input_tokens: u?.input_tokens ?? 0,
      output_tokens: u?.output_tokens ?? 0,
      cache_creation_input_tokens: u?.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: u?.cache_read_input_tokens ?? 0,
    })
  }
  const roundCost = () => Math.round(totalCost * 10000) / 10000

  // ── Tool-use loop ──────────────────────────────────────────────────────────
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response: Anthropic.Message
    try {
      response = await getClient().messages.create({
        model,
        max_tokens: 1500,
        system: systemBlocks,
        tools: ALL_TOOLS,
        messages: convo,
      })
    } catch (err: any) {
      console.error('[AI chat] Anthropic API error:', err)
      const msg = err?.status === 401
        ? 'Chave da API inválida. Verifique ANTHROPIC_API_KEY no .env.'
        : err?.status === 429
        ? 'Limite de requisições atingido. Aguarde um momento e tente novamente.'
        : `Erro na API de IA: ${err?.message ?? 'erro desconhecido'}`
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    accCost(response.usage)

    const textBlocks = response.content.filter(c => c.type === 'text') as Anthropic.TextBlock[]
    const toolUses = response.content.filter(c => c.type === 'tool_use') as Anthropic.ToolUseBlock[]
    const text = textBlocks.map(b => b.text).join('\n').trim()

    // No tools → final answer
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return NextResponse.json({ message: text, model: modelLabel, cost: roundCost() })
    }

    // Write tool → stop and ask user to confirm (do NOT execute)
    const writeTool = toolUses.find(t => WRITE_TOOL_NAMES.includes(t.name))
    if (writeTool) {
      const summary = await buildActionSummary(writeTool.name, writeTool.input)
      return NextResponse.json({
        message: text,
        model: modelLabel,
        cost: roundCost(),
        pendingAction: { tool: writeTool.name, args: writeTool.input, summary },
      })
    }

    // Read tools → execute and feed results back
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const tu of toolUses) {
      if (!READ_TOOL_NAMES.includes(tu.name)) continue
      const result = await executeReadTool(tu.name, tu.input)
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) })
    }

    convo.push({ role: 'assistant', content: response.content })
    convo.push({ role: 'user', content: toolResults })
  }

  return NextResponse.json({
    message: 'Não consegui concluir a solicitação em tempo hábil. Tente reformular ou detalhar melhor o pedido.',
    model: modelLabel,
    cost: roundCost(),
  })
}
