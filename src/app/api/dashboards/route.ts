import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const dashboards = await prisma.userDashboard.findMany({
    where: { userId },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    select: { id: true, name: true, description: true, pinned: true, createdAt: true, updatedAt: true, prompt: true },
  })

  return NextResponse.json(dashboards)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const { name, description, prompt, config } = await req.json()

  if (!name || !config) return NextResponse.json({ error: 'name and config required' }, { status: 400 })

  try {
    const dashboard = await prisma.userDashboard.create({
      data: { userId, name, description, prompt, config: JSON.stringify(config) },
    })
    return NextResponse.json(dashboard, { status: 201 })
  } catch (e: any) {
    console.error('[POST /api/dashboards]', e?.message)
    return NextResponse.json({ error: e?.message ?? 'Erro ao salvar dashboard' }, { status: 500 })
  }
}
