import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { DATA_KEY_DESCRIPTIONS, DashboardConfig } from '@/lib/dashboard-engine'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `Você é o gerador de dashboards do Arcadia — um sistema de gestão escolar.

Sua tarefa: receber um pedido em linguagem natural e retornar SOMENTE um JSON válido de configuração de dashboard.

## DataKeys disponíveis (use apenas estes):
${Object.entries(DATA_KEY_DESCRIPTIONS).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n')}

## Tipos de widget (type):
- \`METRIC\` — um único número grande (ex: média geral, total de alunos)
- \`LIST\` — lista de itens com nome e valor (ex: ranking, alunos em risco)
- \`PROGRESS_BARS\` — barras de progresso (ex: distribuição de níveis, adesão)
- \`TABLE\` — tabela com cabeçalhos e linhas (ex: notas por avaliação, SAEB por descritor)
- \`ALERT_LIST\` — lista de alertas com rótulo e detalhe (ex: alunos em situação de risco)

## Tamanhos de widget (size):
- \`sm\` — pequeno (ideal para METRIC)
- \`md\` — médio
- \`lg\` — largo (ideal para TABLE, PROGRESS_BARS)
- \`full\` — largura total

## Formato JSON obrigatório:
\`\`\`json
{
  "title": "Título do Dashboard",
  "description": "Descrição curta opcional",
  "widgets": [
    {
      "id": "w1",
      "type": "METRIC",
      "title": "Título do Widget",
      "dataKey": "saeb_media_geral",
      "params": { "area": "Língua Portuguesa" },
      "size": "sm"
    }
  ]
}
\`\`\`

## Regras:
- Retorne SOMENTE o JSON, sem explicações, sem markdown, sem \`\`\`
- Use entre 2 e 6 widgets por dashboard
- Os IDs dos widgets devem ser únicos (w1, w2, w3...)
- Use apenas os dataKeys listados acima
- Para params: use somente as chaves documentadas (classId, area, subjectId, threshold)
- Se o pedido for sobre SAEB, prefira: saeb_media_geral + saeb_nivel_distribuicao + saeb_por_descritor
- Se o pedido for sobre risco ou atenção, inclua: alunos_risco + saeb_alunos_abaixo
- Se o pedido for geral/overview, inclua: total_alunos + comparativo_turmas + alunos_risco`

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada.' },
      { status: 503 }
    )
  }

  const { prompt } = await req.json()
  if (!prompt?.trim()) return NextResponse.json({ error: 'prompt required' }, { status: 400 })

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

  let config: DashboardConfig
  try {
    config = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Não foi possível gerar o dashboard. Tente reformular o pedido.' }, { status: 422 })
  }

  return NextResponse.json({ config })
}
