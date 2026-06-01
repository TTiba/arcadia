import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { CompactDashboardConfig, buildBlockCatalog } from '@/lib/dashboard-blocks'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// System prompt is intentionally short — blocks carry the complexity,
// so the AI only needs to select IDs + params (tiny output = few tokens).
function buildSystemPrompt() {
  return `Você é o gerador de dashboards do Arcadia (sistema de gestão escolar).

Retorne SOMENTE um JSON compacto selecionando os blocos que melhor atendem o pedido.

## Blocos disponíveis:
${buildBlockCatalog()}

## Formato de saída (SOMENTE este JSON, sem markdown, sem explicações):
{"title":"Título","description":"Descrição curta","blocks":[{"blockId":"saeb_overview","params":{"area":"Língua Portuguesa"}},{"blockId":"students_at_risk"}]}

## Guia de seleção:
- Pedido sobre SAEB → saeb_overview + saeb_descriptor_detail (+ saeb_at_risk se mencionar risco)
- Pedido sobre ENEM → enem_competency + enem_ranking
- Pedido sobre tarefas → homework_adherence + homework_pending
- Pedido sobre notas → grade_summary (+ grade_low se mencionar baixo desempenho)
- Pedido sobre risco/atenção → students_at_risk + saeb_at_risk + grade_low
- Pedido geral/executivo → class_total + class_comparison + students_at_risk
- Sempre use 2 a 5 blocos. Nunca repita o mesmo blockId.`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 503 })
  }

  const { prompt } = await req.json()
  if (!prompt?.trim()) return NextResponse.json({ error: 'prompt required' }, { status: 400 })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

  let config: CompactDashboardConfig
  try {
    config = JSON.parse(text)
    if (!config.blocks || !Array.isArray(config.blocks)) throw new Error('invalid')
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível gerar o dashboard. Tente reformular o pedido.' },
      { status: 422 }
    )
  }

  return NextResponse.json({ config })
}
