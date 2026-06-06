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

  const [student, logs] = await Promise.all([
    prisma.student.findUnique({
      where: { id: params.id },
      select: { name: true, status: true, class: { select: { name: true, grade: { select: { name: true } } } } },
    }),
    prisma.studentLog.findMany({
      where: { studentId: params.id },
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (logs.length === 0) {
    return NextResponse.json({ summary: 'Não há registros suficientes para gerar um resumo.' })
  }

  const CATEGORY_LABELS: Record<string, string> = {
    OBSERVACAO: 'Observação', REUNIAO: 'Reunião com família', ADVERTENCIA: 'Advertência',
    ELOGIO: 'Elogio', OCORRENCIA: 'Ocorrência disciplinar', SUSPENSAO: 'Suspensão',
    ENCAMINHAMENTO: 'Encaminhamento', CONTATO: 'Contato com família', OUTRO: 'Outro',
  }

  const logsText = logs.map((l, i) => {
    const date = new Date(l.createdAt).toLocaleDateString('pt-BR')
    const cat = CATEGORY_LABELS[l.category] ?? l.category
    return `${i + 1}. [${date}] ${cat} (por ${l.user.name}): ${l.content}`
  }).join('\n')

  const prompt = `Você é um assistente pedagógico especializado. Analise os registros da ficha disciplinar do aluno abaixo e elabore um resumo analítico claro e objetivo, em português.

Aluno: ${student.name}
Turma: ${student.class?.grade?.name ?? ''} ${student.class?.name ?? ''}
Status: ${student.status}

Registros da ficha (ordem cronológica):
${logsText}

Elabore um resumo que:
1. Destaque padrões de comportamento identificados
2. Mencione pontos positivos (elogios, progressos)
3. Aponte preocupações ou situações recorrentes
4. Sugira 2-3 encaminhamentos ou ações recomendadas

Seja conciso (máximo 250 palavras) e use linguagem profissional adequada ao contexto escolar.`

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const summary = (response.content[0] as any).text as string
  return NextResponse.json({ summary })
}
