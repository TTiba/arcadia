import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildUserContext, applyClassScope, applyStudentScope, type UserContext } from '@/lib/user-context'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Cap how many students are serialized into the prompt to keep the context
// (and token cost) bounded on larger schools.
const MAX_STUDENTS_IN_CONTEXT = 120

async function buildSchoolContext(ctx: UserContext) {
  // Scope every query to the data this user is allowed to see. For PROFESSOR
  // this is limited to their assigned classes; ADMIN/COORDENACAO/PEDAGOGO are
  // unrestricted (allowedClassIds === null).
  const classWhere = ctx.allowedClassIds ? { id: { in: ctx.allowedClassIds } } : {}

  const [
    classes,
    allStudents,
    assessments,
    homework,
    classRecords,
    pedagogicalRecords,
    saebPerformances,
    enemPerformances,
  ] = await Promise.all([
    prisma.class.findMany({
      where: classWhere,
      include: { teacherClasses: { include: { teacher: { include: { user: true } }, subject: true } } }
    }),
    prisma.student.findMany({
      where: applyClassScope({}, ctx),
      include: {
        class: true,
        gradeRecords: { include: { assessment: { include: { subject: true } } } },
        homeworkSubmissions: { include: { homework: { include: { subject: true } } } },
        saebPerformances: { include: { descriptor: true } },
        enemPerformances: { include: { competency: true } },
      }
    }),
    prisma.assessment.findMany({ where: applyClassScope({}, ctx), include: { subject: true, class: true } }),
    prisma.homework.findMany({
      where: applyClassScope({}, ctx),
      include: {
        subject: true, class: true,
        submissions: true,
        _count: { select: { submissions: true } },
      }
    }),
    prisma.classRecord.findMany({
      where: applyClassScope({}, ctx),
      include: { class: true, subject: true, teacher: { include: { user: true } } },
      orderBy: { date: 'desc' }, take: 30,
    }),
    prisma.pedagogicalRecord.findMany({
      where: applyStudentScope({ confidentiality: { not: 'CONFIDENCIAL' } }, ctx),
      include: { student: true },
      orderBy: { date: 'desc' }, take: 20,
    }),
    prisma.studentSaebPerformance.findMany({ where: applyStudentScope({}, ctx), include: { descriptor: true, student: true } }),
    prisma.studentEnemPerformance.findMany({ where: applyStudentScope({}, ctx), include: { competency: true, student: true } }),
  ])

  // Bound the per-student payload that goes into the prompt.
  const students = allStudents.slice(0, MAX_STUDENTS_IN_CONTEXT)
  const studentsTruncated = allStudents.length - students.length

  // Summarize SAEB by descriptor
  const saebByDescriptor: Record<string, { desc: string; area: string; scores: number[]; abaixo: number; basico: number; adequado: number }> = {}
  for (const p of saebPerformances) {
    const key = p.descriptor.code
    if (!saebByDescriptor[key]) {
      saebByDescriptor[key] = { desc: p.descriptor.description, area: p.descriptor.area, scores: [], abaixo: 0, basico: 0, adequado: 0 }
    }
    saebByDescriptor[key].scores.push(p.score)
    if (p.level === 'ADEQUADO') saebByDescriptor[key].adequado++
    else if (p.level === 'BASICO') saebByDescriptor[key].basico++
    else saebByDescriptor[key].abaixo++
  }

  // Summarize ENEM by competency
  const enemByComp: Record<string, { desc: string; area: string; scores: number[] }> = {}
  for (const p of enemPerformances) {
    const key = p.competency.code
    if (!enemByComp[key]) {
      enemByComp[key] = { desc: p.competency.description, area: p.competency.area, scores: [] }
    }
    enemByComp[key].scores.push(p.score)
  }

  const avg = (arr: number[]) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 'N/A'

  const studentSummaries = students.map(s => {
    const grades = s.gradeRecords.map(g => `${g.assessment.subject.name} (${g.assessment.name}): ${g.score ?? 'S/N'}/10`)
    const hwDone = s.homeworkSubmissions.length
    const saeb = s.saebPerformances.map(p => `${p.descriptor.code}: ${p.score} (${p.level})`)
    const enem = s.enemPerformances.map(p => `${p.competency.code}: ${p.score}pts`)
    return {
      name: s.name,
      class: s.class?.name || 'Sem turma',
      status: s.status,
      grades,
      hwDone,
      saeb: saeb.length ? saeb : null,
      enem: enem.length ? enem : null,
      pedagogical: pedagogicalRecords.filter(pr => pr.studentId === s.id).map(pr => `${pr.type}: ${pr.title}`),
    }
  })

  const homeworkSummary = homework.map(hw => ({
    title: hw.title,
    subject: hw.subject.name,
    class: hw.class.name,
    dueDate: hw.dueDate?.toLocaleDateString('pt-BR') || 'Sem prazo',
    submissions: hw._count.submissions,
    totalStudents: students.filter(s => s.classId === hw.classId).length,
  }))

  const saebSummary = Object.entries(saebByDescriptor).map(([code, d]) => ({
    code, description: d.desc, area: d.area,
    mediaScore: avg(d.scores),
    adequado: d.adequado, basico: d.basico, abaixoBasico: d.abaixo,
  }))

  const enemSummary = Object.entries(enemByComp).map(([code, d]) => ({
    code, description: d.desc, area: d.area,
    mediaScore: avg(d.scores),
  }))

  return {
    escopo: ctx.allowedClassIds
      ? 'Dados restritos às turmas atribuídas a este usuário (professor).'
      : 'Acesso completo aos dados da escola.',
    alunosOmitidos: studentsTruncated > 0
      ? `${studentsTruncated} aluno(s) omitido(s) do contexto por limite de tamanho. Sinalize que a análise pode estar incompleta se necessário.`
      : null,
    turmas: classes.map(c => ({
      nome: c.name, turno: c.shift, ano: c.year,
      professores: c.teacherClasses.map(tc => `${tc.teacher.user.name} (${tc.subject.name})`),
    })),
    alunos: studentSummaries,
    tarefas: homeworkSummary,
    registrosAula: classRecords.map(r => ({
      data: r.date.toLocaleDateString('pt-BR'),
      turma: r.class.name,
      componente: r.subject?.name || '',
      professor: r.teacher.user.name,
      conteudo: r.contentDeveloped,
      pendencias: r.pending || null,
    })),
    desempenhoSAEB: saebSummary,
    desempenhoENEM: enemSummary,
    alertasPedagogicos: pedagogicalRecords.map(pr => ({
      aluno: pr.student.name,
      tipo: pr.type,
      titulo: pr.title,
      data: pr.date.toLocaleDateString('pt-BR'),
    })),
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada. Adicione a chave no arquivo .env e reinicie o servidor.' },
      { status: 503 }
    )
  }

  const { messages } = await req.json()
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages array required' }, { status: 400 })
  }

  const ctx = await buildUserContext(session)
  const schoolData = await buildSchoolContext(ctx)

  const systemPrompt = `Você é o Assistente Pedagógico Arcadia — um assistente de inteligência artificial especializado em gestão escolar e análise de dados educacionais.

Você tem acesso aos dados atualizados da escola. Use-os para responder perguntas, gerar relatórios e oferecer insights pedagógicos.

## DADOS DA ESCOLA (${new Date().toLocaleDateString('pt-BR')})

\`\`\`json
${JSON.stringify(schoolData, null, 2)}
\`\`\`

## INSTRUÇÕES
- Responda sempre em português brasileiro
- Seja objetivo e pedagógico. Use dados reais da escola sempre que relevante
- Para relatórios, use markdown com tabelas quando apropriado
- Níveis SAEB: ADEQUADO (≥7.0), BASICO (5.0–6.9), ABAIXO_BASICO (<5.0)
- Pontuação ENEM: escala 0–1000. Média nacional ~550
- Quando identificar riscos (alunos abaixo do básico, muitas tarefas pendentes, registros pedagógicos), sinalize com clareza
- Nunca invente dados. Se não houver dados para responder, diga isso claramente`

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  })

  const block = response.content[0]
  const text = block && block.type === 'text' ? block.text : ''
  return NextResponse.json({ message: text })
}
