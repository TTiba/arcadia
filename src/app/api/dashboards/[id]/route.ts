import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executeDashboard, DashboardConfig } from '@/lib/dashboard-engine'
import { expandBlocks, isCompact } from '@/lib/dashboard-blocks'

async function resolveConfig(raw: string): Promise<DashboardConfig> {
  const parsed = JSON.parse(raw)
  return isCompact(parsed) ? await expandBlocks(parsed) : (parsed as DashboardConfig)
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const dashboard = await prisma.userDashboard.findFirst({ where: { id: params.id, userId } })
  if (!dashboard) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const config = resolveConfig(dashboard.config)
  const widgets = await executeDashboard(config)

  return NextResponse.json({ dashboard, config, widgets })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const body = await req.json()

  await prisma.userDashboard.updateMany({
    where: { id: params.id, userId },
    data: {
      ...(body.pinned !== undefined ? { pinned: body.pinned } : {}),
      ...(body.name ? { name: body.name } : {}),
    },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  await prisma.userDashboard.deleteMany({ where: { id: params.id, userId } })
  return NextResponse.json({ ok: true })
}
