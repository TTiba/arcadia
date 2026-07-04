import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { getSchoolScope, schoolWhere } from '@/lib/user-context'
import {
  buildRoster, scrubText, getOrCreateAlias,
  remapAliasesForDisplay, containsPiiPatterns,
} from '@/lib/ai-privacy'

let _client: Anthropic | null = null
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

// Resumo de ficha com privacidade: o aluno vira um alias (aluno_8391), a
// turma vira alias, quem registrou vira alias, e o conteúdo das ocorrências
// passa pelo scrubber (colegas, responsáveis e equipe citados no texto).
// A resposta é remapeada localmente antes de exibir — a pedagoga continua
// lendo o nome real; a Anthropic nunca o viu.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const schoolId = await getSchoolScope(session)
  if (schoolId) {
    const studentExists = await prisma.student.findFirst({
      where: {
        id: params.id,
        ...schoolWhere.student(schoolId),
      }
    })
    if (!studentExists) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Chave da API inválida. Verifique ANTHROPIC_API_KEY no .env.' }, { status: 500 })
  }

  const student = await prisma.student.findUnique({
    where: { id: params.id },
    include: {
      class: { include: { grade: true } },
      studentLogs: {
        include: { user: { select: { id: true, name: true, teacher: { select: { id: true } } } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (student.studentLogs.length === 0) {
    return NextResponse.json({ summary: 'Nenhum registro encontrado na ficha disciplinar deste aluno.' })
  }

  // Aliases do sujeito e da turma; roster da turma para limpar o texto livre
  // (colegas e responsáveis costumam ser citados nas ocorrências)
  const studentAlias = await getOrCreateAlias('ALUNO', student.id)
  const classAlias = student.classId ? await getOrCreateAlias('TURMA', student.classId) : 'sem turma'
  const roster = await buildRoster(student.classId ? [student.classId] : [], schoolId)

  const authorAlias = new Map<string, string>()
  for (const l of student.studentLogs) {
    if (!authorAlias.has(l.userId)) {
      authorAlias.set(
        l.userId,
        l.user.teacher
          ? await getOrCreateAlias('PROFESSOR', l.user.teacher.id)
          : await getOrCreateAlias('USUARIO', l.userId)
      )
    }
  }

  const logsText = student.studentLogs.map(l =>
    `[${new Date(l.createdAt).toLocaleDateString('pt-BR')}] ${l.category} — ${authorAlias.get(l.userId)}: ${scrubText(l.content, roster)}`
  ).join('\n')

  const prompt = `Você é um assistente pedagógico. Os identificadores no formato aluno_NNNN, turma_NNN e professor_NNN são pseudônimos de privacidade — use-os exatamente como estão, nunca tente adivinhar nomes reais.
Abaixo estão os registros da ficha disciplinar do aluno ${studentAlias} (turma ${classAlias}).

${logsText}

Faça um resumo objetivo e estruturado desses registros, destacando:
- Principais ocorrências e padrões de comportamento
- Pontos positivos registrados
- Situações que merecem atenção
- Recomendações gerais

Refira-se ao aluno sempre como ${studentAlias}. Seja conciso, direto e use linguagem adequada para um relatório escolar.`

  try {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = response.content.find(b => b.type === 'text')
    const raw = block && block.type === 'text' ? block.text : ''

    // Defesa em profundidade: PII na resposta indica vazamento no prompt
    if (containsPiiPatterns(raw)) {
      console.error('[ai-summary] padrões de PII detectados na resposta — bloqueado')
      return NextResponse.json({ error: 'Resumo bloqueado pela verificação de privacidade.' }, { status: 502 })
    }

    // Mapeamento reverso local: aliases → nomes reais, só para exibição
    const summary = await remapAliasesForDisplay(raw)
    return NextResponse.json({ summary })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao gerar resumo.' }, { status: 500 })
  }
}
