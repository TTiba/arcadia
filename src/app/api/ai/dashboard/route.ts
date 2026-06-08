import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import {
  DashboardConfig,
  DashboardWidget,
  WidgetSize,
  DATA_KEY_DESCRIPTIONS,
  DATA_KEY_WIDGET_TYPES,
  getValidDataKeys,
} from '@/lib/dashboard-engine'

let _client: Anthropic | null = null
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

const VALID_SIZES: WidgetSize[] = ['sm', 'md', 'lg', 'full']

// Catalog of real data queries the AI can compose. Each query runs live against
// the DB on every dashboard open (no AI at refresh) — the AI only picks which
// queries + params best answer the request.
function buildCatalog() {
  return Object.entries(DATA_KEY_DESCRIPTIONS)
    .map(([key, desc]) => `- \`${key}\` [${DATA_KEY_WIDGET_TYPES[key] ?? 'LIST'}]: ${desc}`)
    .join('\n')
}

function buildSystemPrompt() {
  return `Você é o gerador de dashboards do Vela (sistema de gestão escolar).

Monte a DEFINIÇÃO de um dashboard — uma lista de widgets — que responde EXATAMENTE ao pedido.
Essa definição é re-executada ao vivo contra o banco de dados a cada abertura; você apenas
escolhe QUAIS consultas usar e com QUAIS parâmetros. Não invente dados nem consultas.

## Consultas disponíveis (dataKey [tipo de widget]: o que retorna):
${buildCatalog()}

## Saída — responda SOMENTE com este JSON (sem markdown, sem explicação):
{"title":"Título específico do pedido","description":"Descrição curta","widgets":[{"type":"TABLE","title":"Alunos abaixo da média por descritor","dataKey":"saeb_alunos_abaixo_media","params":{"area":"Matemática"},"size":"full"}]}

## Regras:
- Use APENAS dataKeys da lista acima. O campo "type" deve ser exatamente o tipo entre colchetes daquele dataKey.
- Escolha a consulta MAIS ESPECÍFICA que atende o pedido. Exemplos:
  · "qual aluno está abaixo da média nos descritores do SAEB, com o aluno, os descritores e a média" → use saeb_alunos_abaixo_media (NÃO use saeb_alunos_abaixo, que só conta descritores).
  · "alunos com nota baixa e em quais disciplinas" → notas_alunos_baixo_desempenho.
- Extraia entidades do pedido e coloque como params dos widgets:
  · turma/série → "classId" (use o nome citado, ex: "9º Ano B")
  · componente/disciplina → "subjectId" (ex: "Matemática")
  · área SAEB → "area" — use EXATAMENTE "Língua Portuguesa" ou "Matemática" (nunca "lp"/"mat")
  · nota de corte → "threshold"; período em dias → "days"
- saeb_matriz já cobre Língua Portuguesa E Matemática juntas por padrão. Para mostrar as duas, use UM ÚNICO widget saeb_matriz SEM o param "area". Só informe "area" para restringir a uma única área. Não crie um saeb_matriz por área.
- Use de 1 a 5 widgets. Nunca repita o mesmo dataKey.
- size: "full" para tabelas/alertas amplos, "sm" para métricas, "md"/"lg" para listas.
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
  let text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1) text = text.slice(firstBrace, lastBrace + 1)

  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch {
    console.error('[dashboard] parse failed. raw:', raw.slice(0, 200))
    return NextResponse.json(
      { error: 'Não foi possível gerar o dashboard. Tente reformular o pedido.' },
      { status: 422 }
    )
  }

  // Validate widgets against the real query catalog. Force the correct widget type,
  // drop unknown dataKeys, and assign stable ids.
  const validKeys = new Set(getValidDataKeys())
  const rawWidgets: any[] = Array.isArray(parsed.widgets) ? parsed.widgets : []
  const seen = new Set<string>()
  const widgets: DashboardWidget[] = []

  for (const w of rawWidgets) {
    if (!w || typeof w.dataKey !== 'string' || !validKeys.has(w.dataKey) || seen.has(w.dataKey)) continue
    seen.add(w.dataKey)
    widgets.push({
      id: `w${widgets.length + 1}`,
      type: DATA_KEY_WIDGET_TYPES[w.dataKey],
      title: typeof w.title === 'string' && w.title.trim() ? w.title.trim() : w.dataKey,
      dataKey: w.dataKey,
      params: w.params && typeof w.params === 'object' ? w.params : undefined,
      size: VALID_SIZES.includes(w.size) ? w.size : undefined,
    })
  }

  if (widgets.length === 0) {
    return NextResponse.json(
      { error: 'Não consegui mapear o pedido para os dados disponíveis. Tente reformular.' },
      { status: 422 }
    )
  }

  const config: DashboardConfig = {
    title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Dashboard',
    description: typeof parsed.description === 'string' ? parsed.description : undefined,
    widgets,
  }

  return NextResponse.json({ config })
}
