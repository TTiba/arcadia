import Anthropic from '@anthropic-ai/sdk'
import { prisma } from './prisma'
import { UserContext, applyClassScope, applyStudentScope } from './user-context'

export type ToolResult = Record<string, unknown> | unknown[]

// ─── Handlers ────────────────────────────────────────────────────────────────

async function getClassSummary(
  input: { classId?: string },
  ctx: UserContext
): Promise<ToolResult> {
  const classWhere = ctx.allowedClassIds
    ? {
        id: input.classId && ctx.allowedClassIds.includes(input.classId)
          ? input.classId
          : { in: ctx.allowedClassIds },
      }
    : input.classId
    ? { id: input.classId }
    : {}

  const classes = await prisma.class.findMany({
    where: classWhere,
    include: {
      students: {
        include: {
          gradeRecords: { select: { score: true } },
          saebPerformances: { select: { level: true } },
          homeworkSubmissions: { select: { homeworkId: true } },
        },
      },
      _count: { select: { homework: true } },
    },
  })

  return classes.map(c => {
    const grades = c.students
      .flatMap(s => s.gradeRecords.map(g => g.score ?? 0))
      .filter(s => s > 0)
    const avgGrade = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null
    const saeb = c.students.flatMap(s => s.saebPerformances)
    const adequado = saeb.filter(p => p.level === 'ADEQUADO').length
    const totalSaeb = saeb.length || 1
    const totalHw = c._count.homework
    const submissions = c.students.flatMap(s => s.homeworkSubmissions).length
    const hwAdesao = totalHw > 0 ? submissions / (c.students.length * totalHw) : null

    return {
      turma: c.name,
      turno: c.shift,
      totalAlunos: c.students.length,
      mediaNotas: avgGrade ? avgGrade.toFixed(1) : 'sem dados',
      saebPctAdequado: `${((adequado / totalSaeb) * 100).toFixed(0)}%`,
      adesaoTarefas: hwAdesao !== null ? `${(hwAdesao * 100).toFixed(0)}%` : 'sem dados',
    }
  })
}

async function searchStudents(
  input: {
    classId?: string
    status?: string
    subjectName?: string
    gradeMin?: number
    gradeMax?: number
    saebLevel?: string
    hasOpenPedagogicalRecord?: boolean
    pendingHomeworkMin?: number
    limit?: number
  },
  ctx: UserContext
): Promise<ToolResult> {
  const limit = Math.min(input.limit ?? 50, 200)
  const where: Record<string, unknown> = {}

  if (ctx.allowedClassIds) {
    where.classId =
      input.classId && ctx.allowedClassIds.includes(input.classId)
        ? input.classId
        : { in: ctx.allowedClassIds }
  } else if (input.classId) {
    where.classId = input.classId
  }

  if (input.status) where.status = input.status

  if (input.gradeMin !== undefined || input.gradeMax !== undefined) {
    const gradeFilter: Record<string, number> = {}
    if (input.gradeMin !== undefined) gradeFilter.gte = input.gradeMin
    if (input.gradeMax !== undefined) gradeFilter.lte = input.gradeMax
    where.gradeRecords = {
      some: {
        score: gradeFilter,
        ...(input.subjectName
          ? { assessment: { subject: { name: { contains: input.subjectName } } } }
          : {}),
      },
    }
  }

  if (input.saebLevel) where.saebPerformances = { some: { level: input.saebLevel } }

  if (input.hasOpenPedagogicalRecord) {
    where.pedagogicalRecords = {
      some: { resolved: false, confidentiality: { not: 'CONFIDENCIAL' } },
    }
  }

  const students = await prisma.student.findMany({
    where,
    take: limit,
    include: {
      class: { select: { name: true } },
      gradeRecords: { include: { assessment: { include: { subject: { select: { name: true } } } } } },
      homeworkSubmissions: { select: { homeworkId: true } },
      pedagogicalRecords: {
        where: { confidentiality: { not: 'CONFIDENCIAL' } },
        select: { type: true, title: true, resolved: true },
      },
      saebPerformances: { select: { level: true, score: true } },
    },
  })

  let filtered = students

  if (input.pendingHomeworkMin !== undefined && input.pendingHomeworkMin > 0) {
    const hwWhere = ctx.allowedClassIds ? { classId: { in: ctx.allowedClassIds } } : {}
    const homework = await prisma.homework.findMany({ where: hwWhere, select: { id: true } })
    filtered = students.filter(s => {
      const submitted = new Set(s.homeworkSubmissions.map(h => h.homeworkId))
      return homework.filter(hw => !submitted.has(hw.id)).length >= input.pendingHomeworkMin!
    })
  }

  return filtered.map(s => {
    const avgGrade =
      s.gradeRecords.length
        ? (s.gradeRecords.reduce((a, r) => a + (r.score ?? 0), 0) / s.gradeRecords.length).toFixed(1)
        : 'sem dados'
    return {
      nome: s.name,
      matricula: s.enrollment,
      turma: s.class?.name ?? 'sem turma',
      status: s.status,
      mediaGeral: avgGrade,
      niveisSaeb: Array.from(new Set(s.saebPerformances.map(p => p.level))),
      registrosPedagogicos: s.pedagogicalRecords.map(
        r => `${r.type}: ${r.title}${r.resolved ? ' (resolvido)' : ''}`
      ),
    }
  })
}

async function getStudentDetail(
  input: { studentId?: string; studentName?: string },
  ctx: UserContext
): Promise<ToolResult> {
  if (!input.studentId && !input.studentName) {
    return { erro: 'Informe studentId ou studentName' }
  }

  const where: Record<string, unknown> = {}
  if (input.studentId) where.id = input.studentId
  else where.name = { contains: input.studentName }
  if (ctx.allowedClassIds) where.classId = { in: ctx.allowedClassIds }

  const student = await prisma.student.findFirst({
    where,
    include: {
      class: true,
      gradeRecords: { include: { assessment: { include: { subject: true } } } },
      saebPerformances: { include: { descriptor: true } },
      enemPerformances: { include: { competency: true } },
      pedagogicalRecords: {
        where: { confidentiality: { not: 'CONFIDENCIAL' } },
        orderBy: { date: 'desc' },
      },
      homeworkSubmissions: { include: { homework: { include: { subject: true } } } },
      guardians: { select: { name: true, relationship: true, phone: true, isPrimary: true } },
    },
  })

  if (!student) return { erro: 'Aluno não encontrado ou sem permissão de acesso' }

  const grades = student.gradeRecords.map(g => ({
    componente: g.assessment.subject.name,
    avaliacao: g.assessment.name,
    nota: g.score,
    max: g.assessment.maxScore,
  }))
  const mediaGeral =
    grades.length
      ? (grades.reduce((a, g) => a + (g.nota ?? 0), 0) / grades.length).toFixed(1)
      : 'sem dados'

  return {
    nome: student.name,
    matricula: student.enrollment,
    turma: student.class?.name ?? 'sem turma',
    status: student.status,
    mediaGeral,
    notas: grades,
    saeb: student.saebPerformances.map(p => ({
      descritor: p.descriptor.code,
      area: p.descriptor.area,
      nota: p.score,
      nivel: p.level,
    })),
    enem: student.enemPerformances.map(p => ({
      competencia: p.competency.code,
      area: p.competency.area,
      nota: p.score,
    })),
    registrosPedagogicos: student.pedagogicalRecords.map(r => ({
      tipo: r.type,
      titulo: r.title,
      data: r.date.toLocaleDateString('pt-BR'),
      resolvido: r.resolved,
    })),
    responsaveis: student.guardians,
  }
}

async function getSubjectPerformance(
  input: { subjectName: string; classId?: string; threshold?: number },
  ctx: UserContext
): Promise<ToolResult> {
  const threshold = input.threshold ?? 5
  const baseWhere: Record<string, unknown> = {}
  if (input.subjectName) baseWhere.subject = { name: { contains: input.subjectName } }
  const assessmentWhere = applyClassScope(baseWhere, ctx, input.classId)

  const assessments = await prisma.assessment.findMany({
    where: assessmentWhere,
    include: {
      subject: true,
      class: true,
      gradeRecords: true,
    },
  })

  if (!assessments.length) {
    return { erro: `Nenhuma avaliação encontrada para "${input.subjectName}"` }
  }

  const allScores = assessments
    .flatMap(a => a.gradeRecords.map(g => g.score ?? 0))
    .filter(s => s > 0)
  const avg = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0

  return {
    componente: input.subjectName,
    totalAvaliacoes: assessments.length,
    mediaGeral: avg.toFixed(1),
    totalNotas: allScores.length,
    abaixoLimite: allScores.filter(s => s < threshold).length,
    pctAbaixo: `${((allScores.filter(s => s < threshold).length / (allScores.length || 1)) * 100).toFixed(0)}%`,
    limiteUsado: threshold,
    porTurma: assessments.map(a => {
      const scores = a.gradeRecords.map(g => g.score ?? 0).filter(s => s > 0)
      const turmaAvg = scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : 0
      return {
        turma: a.class.name,
        avaliacao: a.name,
        media: turmaAvg.toFixed(1),
        abaixo: scores.filter(s => s < threshold).length,
      }
    }),
  }
}

async function getSaebIndicators(
  input: { area?: string; classId?: string; level?: string },
  ctx: UserContext
): Promise<ToolResult> {
  const where = applyStudentScope({}, ctx, input.classId)
  if (input.area) (where as any).descriptor = { area: { contains: input.area } }
  if (input.level) (where as any).level = input.level

  const perfs = await prisma.studentSaebPerformance.findMany({
    where,
    include: { descriptor: true },
  })

  const total = perfs.length || 1
  const adequado = perfs.filter(p => p.level === 'ADEQUADO').length
  const basico = perfs.filter(p => p.level === 'BASICO').length
  const abaixo = perfs.filter(p => p.level === 'ABAIXO_BASICO').length

  const byDescriptor: Record<string, { area: string; scores: number[]; levels: string[] }> = {}
  for (const p of perfs) {
    if (!byDescriptor[p.descriptor.code]) {
      byDescriptor[p.descriptor.code] = { area: p.descriptor.area, scores: [], levels: [] }
    }
    byDescriptor[p.descriptor.code].scores.push(p.score)
    byDescriptor[p.descriptor.code].levels.push(p.level)
  }

  return {
    totalRegistros: perfs.length,
    distribuicao: {
      adequado: { total: adequado, pct: `${((adequado / total) * 100).toFixed(0)}%` },
      basico: { total: basico, pct: `${((basico / total) * 100).toFixed(0)}%` },
      abaixoBasico: { total: abaixo, pct: `${((abaixo / total) * 100).toFixed(0)}%` },
    },
    pioresDescritores: Object.entries(byDescriptor)
      .map(([code, d]) => ({
        codigo: code,
        area: d.area,
        media: (d.scores.reduce((a, b) => a + b, 0) / d.scores.length).toFixed(1),
        pctAbaixoBasico: `${(
          (d.levels.filter(l => l === 'ABAIXO_BASICO').length / d.levels.length) *
          100
        ).toFixed(0)}%`,
      }))
      .sort((a, b) => parseFloat(a.media) - parseFloat(b.media))
      .slice(0, 10),
  }
}

async function getAtRiskStudents(
  input: { classId?: string; riskScoreMin?: number; includeStatus?: string[] },
  ctx: UserContext
): Promise<ToolResult> {
  const riskMin = input.riskScoreMin ?? 3
  const studentWhere = applyClassScope({}, ctx, input.classId)
  const homeworkWhere = applyClassScope({}, ctx, input.classId)

  if (input.includeStatus?.length) {
    (studentWhere as any).status = { in: input.includeStatus }
  }

  const [students, homework] = await Promise.all([
    prisma.student.findMany({
      where: studentWhere,
      include: {
        class: { select: { name: true } },
        saebPerformances: { select: { level: true } },
        homeworkSubmissions: { select: { homeworkId: true } },
        pedagogicalRecords: {
          where: { resolved: false, confidentiality: { not: 'CONFIDENCIAL' } },
          select: { type: true, title: true },
        },
        guardians: { select: { name: true, phone: true, isPrimary: true } },
      },
    }),
    prisma.homework.findMany({ where: homeworkWhere, select: { id: true } }),
  ])

  const atRisk = students
    .map(s => {
      const abaixo = s.saebPerformances.filter(p => p.level === 'ABAIXO_BASICO').length
      const submitted = new Set(s.homeworkSubmissions.map(h => h.homeworkId))
      const pendingHw = homework.filter(hw => !submitted.has(hw.id)).length
      const alerts = s.pedagogicalRecords.length
      const riskScore = abaixo * 2 + pendingHw + alerts * 1.5
      return { student: s, abaixo, pendingHw, alerts, riskScore }
    })
    .filter(r => r.riskScore >= riskMin)
    .sort((a, b) => b.riskScore - a.riskScore)
    .map(r => ({
      nome: r.student.name,
      matricula: r.student.enrollment,
      turma: r.student.class?.name ?? 'sem turma',
      status: r.student.status,
      pontuacaoRisco: r.riskScore.toFixed(1),
      fatores: [
        r.abaixo > 0 ? `${r.abaixo} descritor(es) SAEB abaixo do básico` : null,
        r.pendingHw > 0 ? `${r.pendingHw} tarefa(s) pendente(s)` : null,
        r.alerts > 0 ? `${r.alerts} registro(s) pedagógico(s) aberto(s)` : null,
      ].filter(Boolean),
      registrosPedagogicos: r.student.pedagogicalRecords.map(p => `${p.type}: ${p.title}`),
      responsavelPrincipal:
        r.student.guardians.find(g => g.isPrimary) ?? r.student.guardians[0] ?? null,
    }))

  return { totalEmRisco: atRisk.length, alunos: atRisk }
}

// ─── Tool registry ────────────────────────────────────────────────────────────

export const AI_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_class_summary',
    description:
      'Indicadores agregados por turma: média de notas, % SAEB adequado, adesão a tarefas, total de alunos. Use para perguntas sobre indicadores ou comparativos por turma.',
    input_schema: {
      type: 'object' as const,
      properties: {
        classId: {
          type: 'string',
          description: 'ID da turma (opcional; omitir para todas as turmas)',
        },
      },
    },
  },
  {
    name: 'search_students',
    description:
      'Busca alunos por critérios: status, nota em componente, nível SAEB, registros pedagógicos abertos, tarefas pendentes. Use para "quais alunos estão em busca ativa", "alunos com média abaixo de X em Matemática", etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        classId: { type: 'string', description: 'Filtrar por turma' },
        status: {
          type: 'string',
          description: 'Status do aluno: ATIVO, INATIVO, TRANSFERIDO, BUSCA_ATIVA',
        },
        subjectName: { type: 'string', description: 'Componente curricular para filtro de nota' },
        gradeMin: { type: 'number', description: 'Nota mínima no componente' },
        gradeMax: { type: 'number', description: 'Nota máxima no componente' },
        saebLevel: {
          type: 'string',
          description: 'Nível SAEB: ADEQUADO, BASICO ou ABAIXO_BASICO',
        },
        hasOpenPedagogicalRecord: {
          type: 'boolean',
          description: 'Somente alunos com registros pedagógicos abertos',
        },
        pendingHomeworkMin: { type: 'number', description: 'Mínimo de tarefas pendentes' },
        limit: { type: 'number', description: 'Máximo de alunos (padrão 50, máx 200)' },
      },
    },
  },
  {
    name: 'get_student_detail',
    description:
      'Perfil completo de um aluno: notas, SAEB, ENEM, registros pedagógicos, responsáveis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        studentId: { type: 'string', description: 'ID do aluno' },
        studentName: { type: 'string', description: 'Nome (busca parcial) se ID não disponível' },
      },
    },
  },
  {
    name: 'get_subject_performance',
    description:
      'Desempenho em um componente curricular: média geral, % abaixo do limiar, detalhamento por turma.',
    input_schema: {
      type: 'object' as const,
      required: ['subjectName'],
      properties: {
        subjectName: { type: 'string', description: 'Nome do componente (ex: "Matemática")' },
        classId: { type: 'string', description: 'Filtrar por turma (opcional)' },
        threshold: { type: 'number', description: 'Nota de corte para "abaixo" (padrão 5)' },
      },
    },
  },
  {
    name: 'get_saeb_indicators',
    description:
      'Indicadores SAEB: distribuição por nível (adequado/básico/abaixo), piores descritores.',
    input_schema: {
      type: 'object' as const,
      properties: {
        area: {
          type: 'string',
          description: 'Área de conhecimento (ex: "Língua Portuguesa", "Matemática")',
        },
        classId: { type: 'string', description: 'Filtrar por turma (opcional)' },
        level: {
          type: 'string',
          description: 'Filtrar por nível: ADEQUADO, BASICO ou ABAIXO_BASICO',
        },
      },
    },
  },
  {
    name: 'get_at_risk_students',
    description:
      'Alunos em risco pedagógico com pontuação composta (SAEB + tarefas + registros). Use para "alunos em risco", "busca ativa", "quem precisa de atenção urgente".',
    input_schema: {
      type: 'object' as const,
      properties: {
        classId: { type: 'string', description: 'Filtrar por turma (opcional)' },
        riskScoreMin: { type: 'number', description: 'Pontuação mínima de risco (padrão 3)' },
        includeStatus: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filtrar por status, ex: ["BUSCA_ATIVA"]',
        },
      },
    },
  },
]

export const TOOL_NAMES = AI_TOOLS.map(t => t.name)

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: UserContext
): Promise<ToolResult> {
  switch (toolName) {
    case 'get_class_summary':
      return getClassSummary(input as Parameters<typeof getClassSummary>[0], ctx)
    case 'search_students':
      return searchStudents(input as Parameters<typeof searchStudents>[0], ctx)
    case 'get_student_detail':
      return getStudentDetail(input as Parameters<typeof getStudentDetail>[0], ctx)
    case 'get_subject_performance':
      return getSubjectPerformance(input as Parameters<typeof getSubjectPerformance>[0], ctx)
    case 'get_saeb_indicators':
      return getSaebIndicators(input as Parameters<typeof getSaebIndicators>[0], ctx)
    case 'get_at_risk_students':
      return getAtRiskStudents(input as Parameters<typeof getAtRiskStudents>[0], ctx)
    default:
      return { erro: `Ferramenta desconhecida: ${toolName}` }
  }
}
