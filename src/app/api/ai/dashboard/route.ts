import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { CompactDashboardConfig, buildBlockCatalog } from '@/lib/dashboard-blocks'

let _client: Anthropic | null = null
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

// The blocks carry the rendering complexity; the AI selects which blocks to use,
// AND — critically — fills in params so two similar requests produce DIFFERENT,
// tailored dashboards instead of the same generic one.
function buildSystemPrompt() {
  return `Você é o gerador de dashboards do Vela (sistema de gestão escolar).

Sua tarefa: interpretar o pedido do usuário e montar um dashboard SOB MEDIDA para aquele pedido específico — não um dashboard genérico.

## Blocos disponíveis:
${buildBlockCatalog()}

## Formato de saída (responda SOMENTE com este JSON, sem markdown, sem explicações):
{"title":"Título específico do pedido","description":"Descrição curta","blocks":[{"blockId":"saeb_overview","params":{"area":"Língua Portuguesa"}},{"blockId":"saeb_at_risk","params":{"area":"Língua Portuguesa"}}]}

## PRINCÍPIO CENTRAL — personalize, não repita:
Dois pedidos parecidos devem gerar dashboards DIFERENTES quando os detalhes diferem. O que diferencia um dashboard:
1. **Params** — extraia TODA entidade citada no pedido e coloque como param dos blocos:
   - turma/série mencionada → "classId" (use o nome citado, ex: "7º Ano A")
   - componente/disciplina → "subjectId" (ex: "Matemática")
   - área SAEB → "area" ("Língua Portuguesa" ou "Matemática")
   - nota de corte → "threshold" (ex: 6)
   - período em dias → "days"
   Se o pedido cita "Matemática da turma 8B", os blocos DEVEM levar params {subjectId:"Matemática", classId:"8B"}.
2. **Composição** — escolha os blocos que respondem exatamente ao que foi pedido, não um conjunto fixo.
3. **Título e descrição** — específicos do pedido (ex: "SAEB de Matemática — 9º Ano B", não "Visão Geral SAEB").

## Granularidade (ajuste a quantidade de blocos ao pedido):
- "resumo" / "visão geral" → 1 a 2 blocos essenciais
- "detalhamento" / "por descritor" / "distribuição" → 3 blocos (visão + detalhe + lista de risco)
- "análise aprofundada" / "completo" → 4 a 5 blocos, incluindo comparativo
- Pedido executivo/geral → métricas amplas + risco + comparativo

## Mapa de intenção (guia, não regra rígida — adapte ao pedido real):
- SAEB → saeb_overview, saeb_descriptor_detail, saeb_at_risk (filtre por "area" se citada)
- ENEM → enem_competency, enem_ranking
- Tarefas → homework_adherence, homework_pending
- Notas → grade_summary, grade_low (use "threshold" se o pedido citar nota de corte)
- Risco/atenção → students_at_risk, saeb_at_risk, grade_low
- Frequência/faltas → attendance_overview (use "days" se citar período)
- Professores/registros → teacher_activity
- Pedagógico → pedagogical_summary
- Comparar turmas → class_comparison

## Regras:
- Use de 1 a 5 blocos. Nunca repita o mesmo blockId no mesmo dashboard.
- SEMPRE propague no(s) bloco(s) os params extraídos do pedido — esse é o principal diferenciador.
- Prefira menos blocos bem-direcionados a muitos blocos genéricos.
- O título deve refletir o pedido exato, nunca um rótulo genérico.`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 503 })
  }

  const { prompt } = await req.json()
  if (!prompt?.trim()) return NextResponse.json({ error: 'prompt required' }, { status: 400 })

  let response
  try {
    response = await getClient().messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2500,
      // Adaptive thinking + medium effort: better interpretation of nuance
      // between similar requests, so dashboards are tailored, not duplicated.
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: prompt }],
    } as any)
  } catch (err: any) {
    console.error('[dashboard] Anthropic API error:', err)
    const msg = err?.status === 401
      ? 'Chave da API inválida. Verifique ANTHROPIC_API_KEY no .env.'
      : err?.status === 429
      ? 'Limite de requisições atingido. Aguarde um momento e tente novamente.'
      : `Erro na API de IA: ${err?.message ?? 'erro desconhecido'}`
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // With adaptive thinking, content may include thinking blocks — pick the text block.
  const textBlock = (response.content as any[]).find(b => b.type === 'text')
  const raw = textBlock?.text?.trim() ?? ''
  // Strip markdown code fences if the model wrapped the JSON, and isolate the JSON object.
  let text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace > 0 || lastBrace < text.length - 1) {
    if (firstBrace !== -1 && lastBrace !== -1) text = text.slice(firstBrace, lastBrace + 1)
  }

  let config: CompactDashboardConfig
  try {
    config = JSON.parse(text)
    if (!config.blocks || !Array.isArray(config.blocks) || config.blocks.length === 0) throw new Error('invalid')
  } catch {
    console.error('[dashboard] parse failed. raw:', raw.slice(0, 200))
    return NextResponse.json(
      { error: 'Não foi possível gerar o dashboard. Tente reformular o pedido.' },
      { status: 422 }
    )
  }

  return NextResponse.json({ config })
}
