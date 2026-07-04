import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { getSchoolScope } from '@/lib/user-context'
import {
  buildRoster, scrubText, getOrCreateAlias,
  remapAliasesForDisplay, containsPiiPatterns,
} from '@/lib/ai-privacy'

let _client: Anthropic | null = null
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

// Resumo interdisciplinar com privacidade: professores viram aliases
// (professor_015), texto livre passa pelo scrubber com o roster das turmas
// da aula, e a resposta é remapeada para nomes reais ANTES de exibir —
// a Anthropic nunca vê nomes; o usuário nunca vê aliases.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Chave da API inválida. Verifique ANTHROPIC_API_KEY no .env.' }, { status: 500 })
  }

  const { lessonId, currentTeacherId } = await req.json()
  if (!lessonId) return NextResponse.json({ error: 'lessonId é obrigatório' }, { status: 400 })

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { lessonClasses: { select: { classId: true } } },
  })

  if (!lesson) return NextResponse.json({ error: 'Aula não encontrada' }, { status: 404 })

  const records = await prisma.classRecord.findMany({
    where: {
      lessonId,
      ...(currentTeacherId ? { NOT: { teacherId: currentTeacherId } } : {}),
    },
    include: {
      teacher: { include: { user: true } },
      subject: true,
    },
    orderBy: { date: 'asc' },
  })

  if (records.length === 0) {
    return NextResponse.json({ summary: 'Nenhum registro de outros professores foi encontrado para esta aula.' })
  }

  // Roster: alunos/responsáveis das turmas desta aula + corpo docente da escola
  const schoolId = await getSchoolScope(session)
  const classIds = Array.from(new Set([
    ...lesson.lessonClasses.map(lc => lc.classId),
    ...records.map(r => r.classId),
  ]))
  const roster = await buildRoster(classIds, schoolId)

  // Cada professor vira um alias estável; o modelo é instruído a citar o alias
  const teacherAlias = new Map<string, string>()
  for (const r of records) {
    if (!teacherAlias.has(r.teacherId)) {
      teacherAlias.set(r.teacherId, await getOrCreateAlias('PROFESSOR', r.teacherId))
    }
  }

  const recordsText = records.map(r =>
    `[${teacherAlias.get(r.teacherId)} - Componente: ${r.subject?.name || 'N/A'}]
Conteúdo Desenvolvido: ${scrubText(r.contentDeveloped, roster)}
${r.observations ? `Observações: ${scrubText(r.observations, roster)}` : ''}
${r.pending ? `Pendências: ${scrubText(r.pending, roster)}` : ''}
${r.adaptations ? `Adaptações realizadas: ${scrubText(r.adaptations, roster)}` : ''}`
  ).join('\n\n')

  const prompt = `Você é um assistente de inteligência artificial de diário de classe.
Os identificadores no formato professor_NNN e aluno_NNNN são pseudônimos de privacidade — use-os exatamente como estão, nunca tente adivinhar nomes reais.
Abaixo estão os registros de outros professores para a aula interdisciplinar "${scrubText(lesson.title, roster)}":

${recordsText}

Escreva uma síntese pedagógica integrada e muito concisa (um único parágrafo curto, de no máximo 4 ou 5 linhas) combinando o que já foi trabalhado nesta aula.
Importante: Você DEVE citar explicitamente cada professor pelo seu identificador (e o componente curricular correspondente entre parênteses) e resumir de forma resumida o que cada um realizou.
Escreva em português de forma direta, sem introduções, cumprimentos ou rodeios, pronta para o diário de classe.`

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
      console.error('[summarize-lessons] padrões de PII detectados na resposta — bloqueado')
      return NextResponse.json({ error: 'Resumo bloqueado pela verificação de privacidade.' }, { status: 502 })
    }

    // Mapeamento reverso local: aliases → nomes reais, só para exibição
    const summary = await remapAliasesForDisplay(raw)
    return NextResponse.json({ summary })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao gerar resumo.' }, { status: 500 })
  }
}
