import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildUserContext, type UserContext } from '@/lib/user-context'
import { AI_TOOLS, executeTool } from '@/lib/ai-tools'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Máximo de rodadas de tool use antes de encerrar (evita loop infinito).
const MAX_TOOL_ROUNDS = 5

// Contexto mínimo: lista de turmas + componentes. Sem dump de alunos.
// O Claude busca o que precisar via ferramentas.
async function buildMetadataContext(ctx: UserContext) {
  const classWhere = ctx.allowedClassIds ? { id: { in: ctx.allowedClassIds } } : {}
  const [classes, subjects] = await Promise.all([
    prisma.class.findMany({
      where: classWhere,
      select: {
        id: true,
        name: true,
        shift: true,
        year: true,
        _count: { select: { students: true } },
      },
    }),
    prisma.subject.findMany({
      where: { active: true },
      select: { id: true, name: true },
    }),
  ])

  return {
    escopo: ctx.allowedClassIds
      ? 'Dados restritos às turmas atribuídas a este professor.'
      : 'Acesso completo aos dados da escola.',
    turmas: classes.map(c => ({
      id: c.id,
      nome: c.name,
      turno: c.shift,
      ano: c.year,
      totalAlunos: c._count.students,
    })),
    componentes: subjects.map(s => ({ id: s.id, nome: s.name })),
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
  const metadata = await buildMetadataContext(ctx)

  const systemPrompt = `Você é o Assistente Pedagógico Arcadia — especializado em gestão escolar e análise educacional.

Use as ferramentas disponíveis para buscar os dados que precisar antes de responder. Nunca invente dados.

## CONTEXTO DA ESCOLA (${new Date().toLocaleDateString('pt-BR')})
\`\`\`json
${JSON.stringify(metadata, null, 2)}
\`\`\`

## INSTRUÇÕES
- Responda em português brasileiro
- Chame as ferramentas necessárias para obter os dados antes de responder
- Para relatórios use markdown com tabelas quando apropriado
- Níveis SAEB: ADEQUADO (≥7.0), BASICO (5.0–6.9), ABAIXO_BASICO (<5.0)
- Pontuação ENEM: escala 0–1000. Média nacional ~550
- Sinalize riscos com clareza (alunos abaixo do básico, tarefas pendentes, registros pedagógicos)
- Se não houver dados para responder, diga isso claramente`

  let apiMessages: Anthropic.MessageParam[] = messages.map(
    (m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })
  )

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      system: systemPrompt,
      tools: AI_TOOLS,
      messages: apiMessages,
    })

    if (response.stop_reason !== 'tool_use') {
      const block = response.content.find(b => b.type === 'text')
      const text = block && block.type === 'text' ? block.text : ''
      return NextResponse.json({ message: text })
    }

    // Executa todas as ferramentas solicitadas em paralelo
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )
    const toolResults = await Promise.all(
      toolUseBlocks.map(async block => {
        const result = await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          ctx
        )
        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: JSON.stringify(result),
        }
      })
    )

    apiMessages = [
      ...apiMessages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults },
    ]
  }

  return NextResponse.json(
    { error: 'Não foi possível completar a consulta. Tente reformular a pergunta.' },
    { status: 422 }
  )
}
