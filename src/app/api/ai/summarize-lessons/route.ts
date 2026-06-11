import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Chave da API inválida. Verifique ANTHROPIC_API_KEY no .env.' }, { status: 500 })
  }

  const { lessonId, currentTeacherId } = await req.json()
  if (!lessonId) return NextResponse.json({ error: 'lessonId é obrigatório' }, { status: 400 })

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId }
  })

  if (!lesson) return NextResponse.json({ error: 'Aula não encontrada' }, { status: 404 })

  const records = await prisma.classRecord.findMany({
    where: {
      lessonId,
      ...(currentTeacherId ? { NOT: { teacherId: currentTeacherId } } : {})
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

  const recordsText = records.map(r =>
    `[Professor(a): ${r.teacher.user.name} - Componente: ${r.subject?.name || 'N/A'}]
Conteúdo Desenvolvido: ${r.contentDeveloped}
${r.observations ? `Observações: ${r.observations}` : ''}
${r.pending ? `Pendências: ${r.pending}` : ''}
${r.adaptations ? `Adaptações realizadas: ${r.adaptations}` : ''}`
  ).join('\n\n')

  const prompt = `Você é um assistente de inteligência artificial de diário de classe.
Abaixo estão os registros de outros professores para a aula interdisciplinar "${lesson.title}":

${recordsText}

Escreva uma síntese pedagógica integrada e muito concisa (um único parágrafo curto, de no máximo 4 ou 5 linhas) combinando o que já foi trabalhado nesta aula.
Importante: Você DEVE citar explicitamente cada professor pelo nome (e o seu componente curricular correspondente entre parênteses) e resumir de forma resumida o que cada um realizou.
Escreva em português de forma direta, sem introduções, cumprimentos ou rodeios, pronta para o diário de classe.`


  try {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const summary = (response.content[0] as any).text
    return NextResponse.json({ summary })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao gerar resumo.' }, { status: 500 })
  }
}
