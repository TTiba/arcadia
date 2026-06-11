import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// Senha padrão para novos membros criados via assistente
export const DEFAULT_STAFF_PASSWORD = 'vela123'

const TIPO_LABEL: Record<string, string> = {
  PROFESSOR: 'Professor', PEDAGOGO: 'Pedagogo', SECRETARIO: 'Secretário',
}

// ─── Tool definitions (Anthropic format) ────────────────────────────────────

export const READ_TOOLS = [
  {
    name: 'buscar_turmas',
    description: 'Busca turmas/classes da escola pelo nome ou série. Use para resolver nomes como "7A", "7º ano" em IDs antes de cadastrar.',
    input_schema: {
      type: 'object' as const,
      properties: { busca: { type: 'string', description: 'Texto de busca, ex: "7" ou "7A"' } },
    },
  },
  {
    name: 'buscar_componentes',
    description: 'Busca componentes curriculares (disciplinas) pelo nome. Use para resolver "Ciências", "Matemática" em ID.',
    input_schema: {
      type: 'object' as const,
      properties: { busca: { type: 'string', description: 'Nome do componente' } },
    },
  },
  {
    name: 'buscar_series',
    description: 'Lista os segmentos e séries (grades) com seus IDs. Use ao montar currículos.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'buscar_corpo_docente',
    description: 'Busca membros do corpo docente (professores, pedagogos, secretários) por nome ou e-mail.',
    input_schema: {
      type: 'object' as const,
      properties: { busca: { type: 'string' } },
    },
  },
  {
    name: 'buscar_alunos',
    description: 'Busca alunos por nome ou matrícula.',
    input_schema: {
      type: 'object' as const,
      properties: { busca: { type: 'string' } },
    },
  },
]

export const WRITE_TOOLS = [
  {
    name: 'criar_membro_docente',
    description: 'Cadastra um novo membro do corpo docente. Para PROFESSOR informe turmasComponentes (pares turma+componente, ambos como ID). Para PEDAGOGO/SECRETARIO informe turmaIds (lista de IDs de turma). Sempre resolva nomes em IDs usando as ferramentas de busca antes de chamar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nome completo' },
        email: { type: 'string', description: 'E-mail de acesso' },
        tipo: { type: 'string', enum: ['PROFESSOR', 'PEDAGOGO', 'SECRETARIO'] },
        registration: { type: 'string', description: 'Matrícula funcional (opcional)' },
        turmasComponentes: {
          type: 'array',
          description: 'Para professores: pares de turma + componente',
          items: {
            type: 'object',
            properties: { classId: { type: 'string' }, subjectId: { type: 'string' } },
            required: ['classId', 'subjectId'],
          },
        },
        turmaIds: {
          type: 'array',
          description: 'Para pedagogos/secretários: IDs das turmas associadas',
          items: { type: 'string' },
        },
      },
      required: ['name', 'email', 'tipo'],
    },
  },
  {
    name: 'criar_aluno',
    description: 'Cadastra um novo aluno. Resolva o nome da turma em classId via buscar_turmas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        enrollment: { type: 'string', description: 'Número de matrícula único' },
        cgm: { type: 'string', description: 'Código único de identificação (opcional)' },
        classId: { type: 'string', description: 'ID da turma (opcional)' },
      },
      required: ['name', 'enrollment'],
    },
  },
  {
    name: 'criar_componente',
    description: 'Cria um novo componente curricular (disciplina).',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        code: { type: 'string', description: 'Sigla, ex: LP, MAT (opcional)' },
        weeklyHours: { type: 'number', description: 'Horas semanais (opcional)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'adicionar_componente_serie',
    description: 'Adiciona um componente curricular ao currículo de uma série. Resolva os IDs via buscar_series e buscar_componentes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        curriculumId: { type: 'string', description: 'ID do currículo (opcional). Se omitido, associa ao primeiro currículo cadastrado.' },
        gradeId: { type: 'string' },
        subjectId: { type: 'string' },
        weeklyHours: { type: 'number' },
      },
      required: ['gradeId', 'subjectId'],
    },
  },
]

export const WRITE_TOOL_NAMES = WRITE_TOOLS.map(t => t.name)
export const ALL_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS]

// ─── Read tool execution (server-side, immediate) ────────────────────────────

export async function executeReadTool(name: string, input: any): Promise<any> {
  switch (name) {
    case 'buscar_turmas': {
      const busca = (input.busca || '').trim()
      const classes = await prisma.class.findMany({
        where: busca ? {
          OR: [
            { name: { contains: busca } },
            { grade: { name: { contains: busca } } },
          ],
        } : {},
        select: { id: true, name: true, grade: { select: { name: true } }, school: { select: { name: true } } },
        orderBy: { name: 'asc' }, take: 60,
      })
      return classes.map(c => ({ id: c.id, turma: c.name, serie: c.grade?.name, escola: c.school?.name }))
    }
    case 'buscar_componentes': {
      const busca = (input.busca || '').trim()
      const subjects = await prisma.subject.findMany({
        where: { active: true, ...(busca ? { name: { contains: busca } } : {}) },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' }, take: 60,
      })
      return subjects.map(s => ({ id: s.id, componente: s.name, codigo: s.code }))
    }
    case 'buscar_series': {
      const segments = await prisma.segment.findMany({
        select: { name: true, grades: { select: { id: true, name: true }, orderBy: { order: 'asc' } } },
        orderBy: { name: 'asc' },
      })
      return segments.map(seg => ({
        segmento: seg.name,
        series: seg.grades.map(g => ({ id: g.id, serie: g.name })),
      }))
    }
    case 'buscar_corpo_docente': {
      const busca = (input.busca || '').trim()
      const users = await prisma.user.findMany({
        where: {
          role: { in: ['PROFESSOR', 'PEDAGOGO', 'SECRETARIO'] },
          ...(busca ? { OR: [{ name: { contains: busca } }, { email: { contains: busca } }] } : {}),
        },
        select: { id: true, name: true, email: true, role: true, active: true },
        orderBy: { name: 'asc' }, take: 40,
      })
      return users.map(u => ({ id: u.id, nome: u.name, email: u.email, tipo: TIPO_LABEL[u.role] || u.role, ativo: u.active }))
    }
    case 'buscar_alunos': {
      const busca = (input.busca || '').trim()
      const students = await prisma.student.findMany({
        where: busca ? {
          OR: [{ name: { contains: busca } }, { enrollment: { contains: busca } }, { cgm: { contains: busca } }],
        } : {},
        select: { id: true, name: true, enrollment: true, cgm: true, class: { select: { name: true } } },
        orderBy: { name: 'asc' }, take: 40,
      })
      return students.map(s => ({ id: s.id, nome: s.name, matricula: s.enrollment, cgm: s.cgm, turma: s.class?.name }))
    }
    default:
      return { erro: `Ferramenta de leitura desconhecida: ${name}` }
  }
}

// ─── Human-readable summary for the confirmation card ────────────────────────

export async function buildActionSummary(name: string, input: any): Promise<string> {
  switch (name) {
    case 'criar_membro_docente': {
      const tipo = TIPO_LABEL[input.tipo] || input.tipo
      let detalhe = ''
      if (input.tipo === 'PROFESSOR' && input.turmasComponentes?.length) {
        const pairs = await Promise.all(input.turmasComponentes.map(async (tc: any) => {
          const [cls, sub] = await Promise.all([
            prisma.class.findUnique({ where: { id: tc.classId }, select: { name: true } }),
            prisma.subject.findUnique({ where: { id: tc.subjectId }, select: { name: true } }),
          ])
          return `${sub?.name || '?'} em ${cls?.name || '?'}`
        }))
        detalhe = ` — ${pairs.join(', ')}`
      } else if (input.turmaIds?.length) {
        const cls = await prisma.class.findMany({ where: { id: { in: input.turmaIds } }, select: { name: true } })
        detalhe = ` — turmas: ${cls.map(c => c.name).join(', ')}`
      }
      return `Cadastrar ${tipo}: ${input.name} (${input.email})${detalhe}. Senha inicial: ${DEFAULT_STAFF_PASSWORD}`
    }
    case 'criar_aluno': {
      let turma = ''
      if (input.classId) {
        const c = await prisma.class.findUnique({ where: { id: input.classId }, select: { name: true } })
        turma = c ? ` — turma ${c.name}` : ''
      }
      return `Cadastrar aluno: ${input.name} (matrícula ${input.enrollment}${input.cgm ? `, CGM ${input.cgm}` : ''})${turma}`
    }
    case 'criar_componente':
      return `Criar componente curricular: ${input.name}${input.code ? ` (${input.code})` : ''}${input.weeklyHours ? ` — ${input.weeklyHours}h/sem` : ''}`
    case 'adicionar_componente_serie': {
      const [g, s, c] = await Promise.all([
        prisma.grade.findUnique({ where: { id: input.gradeId }, select: { name: true } }),
        prisma.subject.findUnique({ where: { id: input.subjectId }, select: { name: true } }),
        input.curriculumId ? prisma.curriculum.findUnique({ where: { id: input.curriculumId }, select: { name: true } }) : null,
      ])
      const currText = c ? ` no currículo ${c.name}` : ''
      return `Adicionar "${s?.name || '?'}" ao currículo da série ${g?.name || '?'}${currText}${input.weeklyHours ? ` (${input.weeklyHours}h/sem)` : ''}`
    }
    default:
      return `Ação: ${name}`
  }
}

// ─── Write tool execution (only after user confirmation) ─────────────────────

export async function executeWriteTool(name: string, input: any): Promise<{ ok: boolean; message: string }> {
  switch (name) {
    case 'criar_membro_docente': {
      const hashedPassword = await bcrypt.hash(DEFAULT_STAFF_PASSWORD, 10)
      const subjectIds: string[] = input.tipo === 'PROFESSOR' && input.turmasComponentes?.length
        ? Array.from(new Set(input.turmasComponentes.map((tc: any) => tc.subjectId as string)))
        : []

      await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          password: hashedPassword,
          role: input.tipo,
          ...(input.tipo === 'PROFESSOR' ? {
            teacher: {
              create: {
                registration: input.registration || undefined,
                teacherSubjects: subjectIds.length
                  ? { create: subjectIds.map((sid: string) => ({ subjectId: sid })) }
                  : undefined,
                teacherClasses: input.turmasComponentes?.length
                  ? { create: input.turmasComponentes.map((tc: any) => ({ classId: tc.classId, subjectId: tc.subjectId })) }
                  : undefined,
              },
            },
          } : {}),
          ...(['PEDAGOGO', 'SECRETARIO'].includes(input.tipo) && input.turmaIds?.length ? {
            userClasses: { create: input.turmaIds.map((cid: string) => ({ classId: cid })) },
          } : {}),
        },
      })
      return { ok: true, message: `${TIPO_LABEL[input.tipo]} ${input.name} cadastrado com sucesso. Senha inicial: ${DEFAULT_STAFF_PASSWORD}` }
    }

    case 'criar_aluno': {
      await prisma.student.create({
        data: {
          name: input.name,
          enrollment: input.enrollment,
          cgm: input.cgm || undefined,
          classId: input.classId || undefined,
        },
      })
      return { ok: true, message: `Aluno ${input.name} cadastrado com sucesso.` }
    }

    case 'criar_componente': {
      await prisma.subject.create({
        data: {
          name: input.name,
          code: input.code || undefined,
          weeklyHours: input.weeklyHours || 0,
        },
      })
      return { ok: true, message: `Componente "${input.name}" criado com sucesso.` }
    }

    case 'adicionar_componente_serie': {
      let currId = input.curriculumId
      if (!currId) {
        const defaultCurr = await prisma.curriculum.findFirst({ orderBy: { createdAt: 'asc' } })
        if (!defaultCurr) return { ok: false, message: 'Nenhum currículo cadastrado no sistema.' }
        currId = defaultCurr.id
      }
      await prisma.gradeSubject.upsert({
        where: { curriculumId_gradeId_subjectId: { curriculumId: currId, gradeId: input.gradeId, subjectId: input.subjectId } },
        update: { weeklyHours: input.weeklyHours ?? 0 },
        create: { curriculumId: currId, gradeId: input.gradeId, subjectId: input.subjectId, weeklyHours: input.weeklyHours ?? 0 },
      })
      return { ok: true, message: 'Componente adicionado ao currículo da série.' }
    }

    default:
      return { ok: false, message: `Ação desconhecida: ${name}` }
  }
}
