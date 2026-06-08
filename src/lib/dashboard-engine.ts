import { prisma } from './prisma'
import { UserContext, applyClassScope, applyStudentScope } from './user-context'

// ─── Widget & Config Types ────────────────────────────────────────────────────

export type WidgetSize = 'sm' | 'md' | 'lg' | 'full'
export type WidgetType = 'METRIC' | 'LIST' | 'PROGRESS_BARS' | 'TABLE' | 'ALERT_LIST'

export interface DashboardWidget {
  id: string
  type: WidgetType
  title: string
  dataKey: string
  params?: Record<string, string | number>
  size?: WidgetSize
  color?: string
}

export interface DashboardConfig {
  title: string
  description?: string
  widgets: DashboardWidget[]
}

// ─── Data Result Types ────────────────────────────────────────────────────────

export type MetricData = { value: string | number; unit?: string; trend?: string; detail?: string }
export type ListItem = { name: string; value: string | number; badge?: string; badgeColor?: string }
export type ProgressItem = { label: string; value: number; max: number; color: string; detail?: string }
export type TableData = { headers: string[]; rows: (string | number)[][] }
export type AlertItem = { label: string; detail: string; type: string }

export type WidgetData =
  | { type: 'METRIC'; data: MetricData }
  | { type: 'LIST'; data: ListItem[] }
  | { type: 'PROGRESS_BARS'; data: ProgressItem[] }
  | { type: 'TABLE'; data: TableData }
  | { type: 'ALERT_LIST'; data: AlertItem[] }

// ─── Data Keys ───────────────────────────────────────────────────────────────

export const DATA_KEY_DESCRIPTIONS: Record<string, string> = {
  saeb_media_geral: 'Média geral dos alunos no SAEB. Params opcionais: area (ex: "Língua Portuguesa"), classId',
  saeb_nivel_distribuicao: 'Distribuição de alunos por nível SAEB (Adequado / Básico / Abaixo do Básico). Params opcionais: area, classId',
  saeb_por_descritor: 'Desempenho por descritor SAEB. Params opcionais: area, classId. Retorna lista com média por descritor',
  saeb_alunos_abaixo: 'Apenas a CONTAGEM de descritores abaixo do básico por aluno (lista resumida). Params opcionais: area, classId',
  saeb_alunos_abaixo_media: 'Tabela detalhada: cada aluno, QUAIS descritores ele está abaixo da média da turma, e a média de desempenho do aluno. Use quando o pedido quer ver o aluno + os descritores + a média. Params opcionais: area, classId',
  enem_media_por_competencia: 'Média por competência ENEM. Params opcionais: classId',
  enem_ranking_alunos: 'Ranking de alunos por pontuação média ENEM. Params opcionais: classId',
  notas_media_turma: 'Média de notas por disciplina/avaliação. Params opcionais: classId, subjectId',
  notas_alunos_baixo_desempenho: 'Alunos com nota abaixo de um threshold. Params opcionais: classId, threshold (padrão 5)',
  tarefas_adesao: 'Taxa de entrega de tarefas de casa. Params opcionais: classId, subjectId',
  tarefas_pendentes: 'Alunos com mais tarefas não entregues. Params opcionais: classId',
  registros_pedagogicos: 'Resumo de registros pedagógicos por tipo. Params opcionais: classId',
  alunos_risco: 'Alunos em risco: SAEB baixo + tarefas pendentes + registros pedagógicos. Params opcionais: classId',
  atividade_professores: 'Total de registros de aula por professor',
  comparativo_turmas: 'Comparativo de desempenho entre turmas (médias de notas e SAEB)',
  total_alunos: 'Total de alunos matriculados. Params opcionais: classId',
  frequencia_turma: 'Frequência escolar da turma: taxa de presença e alunos em risco. Params opcionais: classId, days (padrão 30)',
}

type Params = Record<string, string | number>

// ─── Query Functions (all receive UserContext for data scoping) ───────────────

async function getSaebMediaGeral(params: Params, ctx: UserContext): Promise<WidgetData> {
  const where = applyStudentScope({}, ctx, params.classId)
  if (params.area) (where as any).descriptor = { area: params.area }

  const performances = await prisma.studentSaebPerformance.findMany({
    where,
    include: { descriptor: true },
  })

  const avg = performances.length
    ? performances.reduce((sum, p) => sum + p.score, 0) / performances.length
    : 0

  return {
    type: 'METRIC',
    data: {
      value: avg.toFixed(1),
      unit: 'pts',
      detail: `${performances.length} avaliações`,
      trend: avg >= 7 ? 'Nível Adequado' : avg >= 5 ? 'Nível Básico' : 'Abaixo do Básico',
    },
  }
}

async function getSaebNivelDistribuicao(params: Params, ctx: UserContext): Promise<WidgetData> {
  const where = applyStudentScope({}, ctx, params.classId)
  if (params.area) (where as any).descriptor = { area: params.area }

  const perfs = await prisma.studentSaebPerformance.findMany({ where })
  const total = perfs.length || 1
  const adequado = perfs.filter(p => p.level === 'ADEQUADO').length
  const basico = perfs.filter(p => p.level === 'BASICO').length
  const abaixo = perfs.filter(p => p.level === 'ABAIXO_BASICO').length

  return {
    type: 'PROGRESS_BARS',
    data: [
      { label: 'Adequado', value: adequado, max: total, color: 'green', detail: `${adequado} alunos` },
      { label: 'Básico', value: basico, max: total, color: 'yellow', detail: `${basico} alunos` },
      { label: 'Abaixo do Básico', value: abaixo, max: total, color: 'red', detail: `${abaixo} alunos` },
    ],
  }
}

async function getSaebPorDescritor(params: Params, ctx: UserContext): Promise<WidgetData> {
  const where = applyStudentScope({}, ctx, params.classId)
  if (params.area) (where as any).descriptor = { area: params.area }

  const perfs = await prisma.studentSaebPerformance.findMany({
    where,
    include: { descriptor: true },
  })

  const byDescriptor: Record<string, { desc: string; scores: number[] }> = {}
  for (const p of perfs) {
    if (!byDescriptor[p.descriptor.code]) {
      byDescriptor[p.descriptor.code] = { desc: p.descriptor.description, scores: [] }
    }
    byDescriptor[p.descriptor.code].scores.push(p.score)
  }

  const rows = Object.entries(byDescriptor).map(([code, d]) => {
    const avg = d.scores.reduce((a, b) => a + b, 0) / d.scores.length
    return [code, d.desc.substring(0, 45) + (d.desc.length > 45 ? '…' : ''), avg.toFixed(1)]
  })

  return { type: 'TABLE', data: { headers: ['Código', 'Descritor', 'Média'], rows } }
}

async function getSaebAlunosAbaixo(params: Params, ctx: UserContext): Promise<WidgetData> {
  const where = applyStudentScope({ level: 'ABAIXO_BASICO' }, ctx, params.classId)
  if (params.area) (where as any).descriptor = { area: params.area }

  const perfs = await prisma.studentSaebPerformance.findMany({
    where,
    include: { student: true, descriptor: true },
  })

  const byStudent: Record<string, { name: string; count: number }> = {}
  for (const p of perfs) {
    if (!byStudent[p.studentId]) byStudent[p.studentId] = { name: p.student.name, count: 0 }
    byStudent[p.studentId].count++
  }

  const items: ListItem[] = Object.values(byStudent)
    .sort((a, b) => b.count - a.count)
    .map(s => ({ name: s.name, value: `${s.count} descritor(es)`, badge: 'Atenção', badgeColor: 'red' }))

  return { type: 'LIST', data: items }
}

// Per-student breakdown: which descriptors a student is below the cohort average on,
// plus the student's overall SAEB average. Answers "qual aluno está abaixo da média
// nos descritores, com o aluno, os descritores e a média do aluno".
async function getSaebAlunosAbaixoMedia(params: Params, ctx: UserContext): Promise<WidgetData> {
  const where = applyStudentScope({}, ctx, params.classId)
  if (params.area) (where as any).descriptor = { area: params.area }

  const perfs = await prisma.studentSaebPerformance.findMany({
    where,
    include: { student: true, descriptor: true },
  })

  // Cohort mean per descriptor
  const descAgg: Record<string, { sum: number; count: number }> = {}
  for (const p of perfs) {
    const code = p.descriptor.code
    if (!descAgg[code]) descAgg[code] = { sum: 0, count: 0 }
    descAgg[code].sum += p.score
    descAgg[code].count++
  }
  const descMean: Record<string, number> = {}
  for (const [code, a] of Object.entries(descAgg)) descMean[code] = a.sum / a.count

  // Per student: descriptors scored below the cohort mean + overall average
  const byStudent: Record<string, { name: string; below: string[]; scores: number[] }> = {}
  for (const p of perfs) {
    if (!byStudent[p.studentId]) byStudent[p.studentId] = { name: p.student.name, below: [], scores: [] }
    const s = byStudent[p.studentId]
    s.scores.push(p.score)
    if (p.score < descMean[p.descriptor.code]) s.below.push(p.descriptor.code)
  }

  const rows = Object.values(byStudent)
    .filter(s => s.below.length > 0)
    .map(s => ({ name: s.name, below: s.below, avg: s.scores.reduce((a, b) => a + b, 0) / s.scores.length }))
    .sort((a, b) => a.avg - b.avg || b.below.length - a.below.length)
    .map(s => [s.name, s.below.join(', '), s.avg.toFixed(1)] as (string | number)[])

  return {
    type: 'TABLE',
    data: { headers: ['Aluno', 'Descritores abaixo da média', 'Média do aluno'], rows },
  }
}

async function getEnemMediaPorCompetencia(params: Params, ctx: UserContext): Promise<WidgetData> {
  const where = applyStudentScope({}, ctx, params.classId)

  const perfs = await prisma.studentEnemPerformance.findMany({
    where,
    include: { competency: true },
  })

  const byComp: Record<string, { desc: string; scores: number[] }> = {}
  for (const p of perfs) {
    if (!byComp[p.competency.code]) byComp[p.competency.code] = { desc: p.competency.description, scores: [] }
    byComp[p.competency.code].scores.push(p.score)
  }

  const rows = Object.entries(byComp).map(([code, d]) => {
    const avg = d.scores.reduce((a, b) => a + b, 0) / d.scores.length
    return [code, d.desc.substring(0, 40) + '…', Math.round(avg)]
  })

  return { type: 'TABLE', data: { headers: ['Código', 'Competência', 'Média (0–1000)'], rows } }
}

async function getEnemRankingAlunos(params: Params, ctx: UserContext): Promise<WidgetData> {
  const where = applyStudentScope({}, ctx, params.classId)

  const perfs = await prisma.studentEnemPerformance.findMany({
    where,
    include: { student: true },
  })

  const byStudent: Record<string, { name: string; scores: number[] }> = {}
  for (const p of perfs) {
    if (!byStudent[p.studentId]) byStudent[p.studentId] = { name: p.student.name, scores: [] }
    byStudent[p.studentId].scores.push(p.score)
  }

  const items: ListItem[] = Object.values(byStudent)
    .map(s => ({ name: s.name, value: Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) }))
    .sort((a, b) => Number(b.value) - Number(a.value))
    .slice(0, 10)
    .map((s, i) => ({ ...s, badge: `${i + 1}º`, badgeColor: i === 0 ? 'green' : 'gray', value: `${s.value} pts` }))

  return { type: 'LIST', data: items }
}

async function getNotasMediaTurma(params: Params, ctx: UserContext): Promise<WidgetData> {
  const where = applyClassScope({}, ctx, params.classId)
  if (params.subjectId) where.subjectId = params.subjectId

  const assessments = await prisma.assessment.findMany({
    where,
    include: { subject: true, class: true, gradeRecords: true },
  })

  const rows = assessments.map(a => {
    const scores = a.gradeRecords.map(g => g.score ?? 0).filter(s => s > 0)
    const avg = scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : 0
    return [a.class.name, a.subject.name, a.name, avg.toFixed(1)]
  })

  return { type: 'TABLE', data: { headers: ['Turma', 'Componente', 'Avaliação', 'Média'], rows } }
}

async function getNotasAlunosBaixoDesempenho(params: Params, ctx: UserContext): Promise<WidgetData> {
  const threshold = Number(params.threshold ?? 5)

  // Teachers can only see grade records for their classes
  const teacherFilter = ctx.allowedClassIds
    ? { assessment: { classId: { in: ctx.allowedClassIds } } }
    : {}

  const records = await prisma.gradeRecord.findMany({
    where: { score: { lt: threshold }, ...teacherFilter },
    include: { student: true, assessment: { include: { subject: true } } },
  })

  const byStudent: Record<string, { name: string; subjects: string[] }> = {}
  for (const r of records) {
    if (!byStudent[r.studentId]) byStudent[r.studentId] = { name: r.student.name, subjects: [] }
    byStudent[r.studentId].subjects.push(`${r.assessment.subject.name}: ${r.score?.toFixed(1)}`)
  }

  const items: ListItem[] = Object.values(byStudent)
    .map(s => ({ name: s.name, value: s.subjects.join(', '), badge: 'Baixo', badgeColor: 'red' }))

  return { type: 'LIST', data: items }
}

async function getTarefasAdesao(params: Params, ctx: UserContext): Promise<WidgetData> {
  const where = applyClassScope({}, ctx, params.classId)
  if (params.subjectId) where.subjectId = params.subjectId

  const homework = await prisma.homework.findMany({
    where,
    include: {
      subject: true,
      class: { include: { students: true } },
      _count: { select: { submissions: true } },
    },
  })

  const items: ProgressItem[] = homework.map(hw => {
    const total = hw.class.students.length || 1
    const done = hw._count.submissions
    return {
      label: `${hw.title} (${hw.subject.name})`,
      value: done,
      max: total,
      color: done / total >= 0.8 ? 'green' : done / total >= 0.5 ? 'yellow' : 'red',
      detail: `${done}/${total} entregas`,
    }
  })

  return { type: 'PROGRESS_BARS', data: items }
}

async function getTarefasPendentes(params: Params, ctx: UserContext): Promise<WidgetData> {
  const studentWhere = applyClassScope({}, ctx, params.classId)
  const homeworkWhere = applyClassScope({}, ctx, params.classId)

  const [students, homework] = await Promise.all([
    prisma.student.findMany({
      where: studentWhere,
      include: { homeworkSubmissions: { select: { homeworkId: true } } },
    }),
    prisma.homework.findMany({ where: homeworkWhere, select: { id: true, classId: true } }),
  ])

  const items: ListItem[] = students
    .map(s => {
      const submitted = new Set(s.homeworkSubmissions.map(hs => hs.homeworkId))
      const pending = homework.filter(hw => !submitted.has(hw.id)).length
      return { name: s.name, value: `${pending} pendente(s)`, pending }
    })
    .filter(s => s.pending > 0)
    .sort((a, b) => b.pending - a.pending)
    .map(s => ({
      name: s.name,
      value: s.value,
      badge: s.pending >= 3 ? 'Crítico' : 'Pendente',
      badgeColor: s.pending >= 3 ? 'red' : 'yellow',
    }))

  return { type: 'LIST', data: items }
}

async function getRegistrosPedagogicos(params: Params, ctx: UserContext): Promise<WidgetData> {
  // Pedagogical records are visible to all roles (CONFIDENCIAL already filtered)
  // but PROFESSOR only sees records of students in their classes
  const where: Record<string, unknown> = { confidentiality: { not: 'CONFIDENCIAL' } }
  if (ctx.allowedClassIds) {
    where.student = { classId: { in: ctx.allowedClassIds } }
  }

  const records = await prisma.pedagogicalRecord.findMany({ where })

  const byType: Record<string, number> = {}
  for (const r of records) {
    byType[r.type] = (byType[r.type] || 0) + 1
  }

  const items: ProgressItem[] = Object.entries(byType).map(([type, count]) => ({
    label: type,
    value: count,
    max: records.length || 1,
    color: type === 'ADVERTENCIA' ? 'red' : type === 'ATENDIMENTO' ? 'yellow' : 'blue',
    detail: `${count} registro(s)`,
  }))

  return { type: 'PROGRESS_BARS', data: items }
}

async function getAlunosRisco(params: Params, ctx: UserContext): Promise<WidgetData> {
  const studentWhere = applyClassScope({}, ctx, params.classId)
  const homeworkWhere = applyClassScope({}, ctx, params.classId)

  // Note: no negation filter inside include — negation + large result sets hit SQLite param limits.
  // Filter confidentiality in JS instead.
  const [students, homework] = await Promise.all([
    prisma.student.findMany({
      where: studentWhere,
      include: {
        saebPerformances: { select: { level: true } },
        homeworkSubmissions: { select: { homeworkId: true } },
        pedagogicalRecords: { select: { id: true, confidentiality: true } },
      },
    }),
    prisma.homework.findMany({ where: homeworkWhere, select: { id: true } }),
  ])

  const atRisk: AlertItem[] = []
  for (const s of students) {
    const abaixo = s.saebPerformances.filter(p => p.level === 'ABAIXO_BASICO').length
    const submitted = new Set(s.homeworkSubmissions.map(hs => hs.homeworkId))
    const pendingHw = homework.filter(hw => !submitted.has(hw.id)).length
    const alerts = s.pedagogicalRecords.filter(r => r.confidentiality !== 'CONFIDENCIAL').length

    const riskScore = abaixo * 2 + pendingHw + alerts * 1.5
    if (riskScore >= 3) {
      const reasons = []
      if (abaixo > 0) reasons.push(`${abaixo} descritor(es) SAEB abaixo do básico`)
      if (pendingHw > 0) reasons.push(`${pendingHw} tarefa(s) pendente(s)`)
      if (alerts > 0) reasons.push(`${alerts} registro(s) pedagógico(s)`)
      atRisk.push({ label: s.name, detail: reasons.join(' · '), type: riskScore >= 6 ? 'CRITICO' : 'ATENCAO' })
    }
  }

  atRisk.sort((a, b) => (b.type === 'CRITICO' ? 1 : 0) - (a.type === 'CRITICO' ? 1 : 0))
  return { type: 'ALERT_LIST', data: atRisk }
}

async function getAtividadeProfessores(params: Params, ctx: UserContext): Promise<WidgetData> {
  // Teachers only see their own activity
  const where: Record<string, unknown> = {}
  if (ctx.role === 'PROFESSOR') {
    const teacher = await prisma.teacher.findUnique({ where: { userId: ctx.userId } })
    if (teacher) where.teacherId = teacher.id
  }

  const records = await prisma.classRecord.findMany({
    where,
    include: { teacher: { include: { user: true } } },
  })

  const byTeacher: Record<string, { name: string; count: number }> = {}
  for (const r of records) {
    const name = r.teacher.user.name
    if (!byTeacher[name]) byTeacher[name] = { name, count: 0 }
    byTeacher[name].count++
  }

  const items: ListItem[] = Object.values(byTeacher)
    .sort((a, b) => b.count - a.count)
    .map(t => ({
      name: t.name,
      value: `${t.count} registro(s)`,
      badge: t.count === 0 ? 'Inativo' : 'Ativo',
      badgeColor: t.count === 0 ? 'red' : 'green',
    }))

  return { type: 'LIST', data: items }
}

async function getComparativoTurmas(params: Params, ctx: UserContext): Promise<WidgetData> {
  const classWhere = ctx.allowedClassIds ? { id: { in: ctx.allowedClassIds } } : {}

  const classes = await prisma.class.findMany({
    where: classWhere,
    include: {
      students: {
        include: {
          gradeRecords: { select: { score: true } },
          saebPerformances: { select: { score: true } },
        },
      },
    },
  })

  const rows = classes.map(c => {
    const allGrades = c.students.flatMap(s => s.gradeRecords.map(g => g.score ?? 0)).filter(s => s > 0)
    const avgGrade = allGrades.length ? (allGrades.reduce((a, b) => a + b, 0) / allGrades.length).toFixed(1) : '-'
    const allSaeb = c.students.flatMap(s => s.saebPerformances.map(p => p.score))
    const avgSaeb = allSaeb.length ? (allSaeb.reduce((a, b) => a + b, 0) / allSaeb.length).toFixed(1) : '-'
    return [c.name, c.shift || '-', c.students.length, avgGrade, avgSaeb]
  })

  return {
    type: 'TABLE',
    data: { headers: ['Turma', 'Turno', 'Alunos', 'Média Notas', 'Média SAEB'], rows },
  }
}

async function getTotalAlunos(params: Params, ctx: UserContext): Promise<WidgetData> {
  const where = applyClassScope({}, ctx, params.classId)
  const count = await prisma.student.count({ where })
  return { type: 'METRIC', data: { value: count, unit: 'alunos', detail: 'matriculados' } }
}

async function getFrequenciaTurma(params: Params, ctx: UserContext): Promise<WidgetData> {
  const days = parseInt(String(params.days ?? 30))
  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)

  const where = applyClassScope({}, ctx, params.classId)
  const students = await prisma.student.findMany({
    where: { ...where, status: 'ATIVO' },
    select: { id: true, name: true, classId: true },
  })

  const studentIds = students.map(s => s.id)
  if (studentIds.length === 0) {
    return { type: 'METRIC', data: { value: '—', detail: 'Nenhum aluno ativo' } }
  }

  // Batch to avoid param limit
  const records: { studentId: string; status: string }[] = []
  for (let i = 0; i < studentIds.length; i += 500) {
    const batch = await prisma.studentAttendance.findMany({
      where: { studentId: { in: studentIds.slice(i, i + 500) }, date: { gte: since } },
      select: { studentId: true, status: true },
    })
    records.push(...batch)
  }

  const schoolDays = new Set(
    await prisma.studentAttendance.findMany({
      where: { studentId: { in: studentIds.slice(0, 1) }, date: { gte: since } },
      select: { date: true },
    }).then(rows => rows.map(r => r.date.toISOString().slice(0, 10)))
  ).size || 1

  const faltaMap = new Map<string, number>()
  for (const r of records) {
    if (r.status === 'FALTA') faltaMap.set(r.studentId, (faltaMap.get(r.studentId) ?? 0) + 1)
  }

  const atRisk = students.filter(s => (faltaMap.get(s.id) ?? 0) >= 5)
  const totalFaltas = Array.from(faltaMap.values()).reduce((a, b) => a + b, 0)
  const avgFrequencia = students.length > 0
    ? Math.round(((schoolDays * students.length - totalFaltas) / (schoolDays * students.length)) * 100)
    : 100

  return {
    type: 'ALERT_LIST',
    data: atRisk.length > 0
      ? atRisk.slice(0, 10).map(s => ({
          label: s.name,
          detail: `${faltaMap.get(s.id) ?? 0} faltas nos últimos ${days} dias`,
          type: (faltaMap.get(s.id) ?? 0) >= 8 ? 'danger' : 'warning',
        }))
      : [{ label: `Frequência média: ${avgFrequencia}%`, detail: `Todos os alunos com frequência adequada nos últimos ${days} dias`, type: 'info' }],
  }
}

// ─── Engine ───────────────────────────────────────────────────────────────────

type QueryFn = (params: Params, ctx: UserContext) => Promise<WidgetData>

const ENGINE: Record<string, QueryFn> = {
  saeb_media_geral: getSaebMediaGeral,
  saeb_nivel_distribuicao: getSaebNivelDistribuicao,
  saeb_por_descritor: getSaebPorDescritor,
  saeb_alunos_abaixo: getSaebAlunosAbaixo,
  saeb_alunos_abaixo_media: getSaebAlunosAbaixoMedia,
  enem_media_por_competencia: getEnemMediaPorCompetencia,
  enem_ranking_alunos: getEnemRankingAlunos,
  notas_media_turma: getNotasMediaTurma,
  notas_alunos_baixo_desempenho: getNotasAlunosBaixoDesempenho,
  tarefas_adesao: getTarefasAdesao,
  tarefas_pendentes: getTarefasPendentes,
  registros_pedagogicos: getRegistrosPedagogicos,
  alunos_risco: getAlunosRisco,
  atividade_professores: getAtividadeProfessores,
  comparativo_turmas: getComparativoTurmas,
  total_alunos: getTotalAlunos,
  frequencia_turma: getFrequenciaTurma,
}

// Widget type each dataKey renders as — lets the dashboard generator (and the UI)
// know the shape without running the query.
export const DATA_KEY_WIDGET_TYPES: Record<string, WidgetType> = {
  saeb_media_geral: 'METRIC',
  saeb_nivel_distribuicao: 'PROGRESS_BARS',
  saeb_por_descritor: 'TABLE',
  saeb_alunos_abaixo: 'LIST',
  saeb_alunos_abaixo_media: 'TABLE',
  enem_media_por_competencia: 'TABLE',
  enem_ranking_alunos: 'LIST',
  notas_media_turma: 'TABLE',
  notas_alunos_baixo_desempenho: 'LIST',
  tarefas_adesao: 'PROGRESS_BARS',
  tarefas_pendentes: 'LIST',
  registros_pedagogicos: 'PROGRESS_BARS',
  alunos_risco: 'ALERT_LIST',
  atividade_professores: 'LIST',
  comparativo_turmas: 'TABLE',
  total_alunos: 'METRIC',
  frequencia_turma: 'ALERT_LIST',
}

export function getValidDataKeys(): string[] {
  return Object.keys(ENGINE)
}

export async function executeWidget(
  widget: DashboardWidget,
  ctx: UserContext
): Promise<WidgetData | null> {
  const fn = ENGINE[widget.dataKey]
  if (!fn) return null
  try {
    return await fn(widget.params || {}, ctx)
  } catch {
    return null
  }
}

export async function executeDashboard(
  config: DashboardConfig,
  ctx: UserContext
): Promise<{ widget: DashboardWidget; data: WidgetData | null }[]> {
  return Promise.all(
    config.widgets.map(async widget => ({ widget, data: await executeWidget(widget, ctx) }))
  )
}
