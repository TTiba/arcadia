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

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userEmail = session.user?.email || ''

  if (role !== 'ADMIN' && role !== 'DIRETOR') {
    let schoolWhere = {}
    if (userEmail.includes('eeteixeira')) {
      schoolWhere = { class: { school: { name: { contains: 'Anísio Teixeira' } } } }
    } else if (userEmail.includes('eemlobato')) {
      schoolWhere = { class: { school: { name: { contains: 'Monteiro Lobato' } } } }
    }

    const studentExists = await prisma.student.findFirst({
      where: {
        id: params.id,
        ...schoolWhere
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
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (student.studentLogs.length === 0) {
    return NextResponse.json({ summary: 'Nenhum registro encontrado na ficha disciplinar deste aluno.' })
  }

  const logsText = student.studentLogs.map(l =>
    `[${new Date(l.createdAt).toLocaleDateString('pt-BR')}] ${l.category} — ${l.user.name}: ${l.content}`
  ).join('\n')

  const prompt = `Você é um assistente pedagógico. Abaixo estão os registros da ficha disciplinar do aluno ${student.name} (Turma: ${student.class?.name || 'N/A'}).

${logsText}

Faça um resumo objetivo e estruturado desses registros, destacando:
- Principais ocorrências e padrões de comportamento
- Pontos positivos registrados
- Situações que merecem atenção
- Recomendações gerais

Seja conciso, direto e use linguagem adequada para um relatório escolar.`

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
