import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { executeWriteTool, WRITE_TOOL_NAMES } from '@/lib/ai-tools'

const WRITE_ROLES = ['ADMIN', 'COORDENACAO', 'DIRETOR']

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (!WRITE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Você não tem permissão para executar esta ação.' }, { status: 403 })
  }

  const { tool, args } = await req.json()
  if (!tool || !WRITE_TOOL_NAMES.includes(tool)) {
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  }

  try {
    const result = await executeWriteTool(tool, args)
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 })

    await createAuditLog({
      userId: (session.user as any).id,
      action: 'CREATE',
      entityType: `AI:${tool}`,
      newData: args,
    })

    return NextResponse.json({ ok: true, message: result.message })
  } catch (err: any) {
    // Friendly messages for common Prisma errors
    let message = err?.message || 'Erro ao executar a ação.'
    if (err?.code === 'P2002') {
      const target = err?.meta?.target
      message = `Já existe um registro com esse valor único${target ? ` (${target})` : ''}. Verifique e-mail/matrícula/CGM duplicados.`
    }
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
