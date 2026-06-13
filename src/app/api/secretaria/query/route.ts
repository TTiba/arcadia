import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildUserContext } from '@/lib/user-context'
import { executeTool, TOOL_NAMES } from '@/lib/ai-tools'

/**
 * Acesso programático às ferramentas de dados da escola — sem IA.
 * Ideal para workflows de secretaria que precisam de dados estruturados diretamente.
 *
 * POST /api/secretaria/query
 * Body: { "tool": "search_students", "params": { "status": "BUSCA_ATIVA" } }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.tool) {
    return NextResponse.json(
      { error: 'Campo "tool" obrigatório', ferramentasDisponiveis: TOOL_NAMES },
      { status: 400 }
    )
  }

  if (!TOOL_NAMES.includes(body.tool)) {
    return NextResponse.json(
      { error: `Ferramenta inválida: "${body.tool}"`, ferramentasDisponiveis: TOOL_NAMES },
      { status: 400 }
    )
  }

  const ctx = await buildUserContext(session)
  const data = await executeTool(body.tool, body.params ?? {}, ctx)
  return NextResponse.json({ data })
}
