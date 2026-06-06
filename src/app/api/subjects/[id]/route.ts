import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'COORDENACAO', 'DIRETOR'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, code, segmentId, weeklyHours, active } = await req.json()

  const subject = await prisma.subject.update({
    where: { id: params.id },
    data: {
      name: name?.trim(),
      code: code?.trim() || null,
      segmentId: segmentId || null,
      weeklyHours: weeklyHours ?? undefined,
      active: active ?? undefined,
    },
    include: { segment: true },
  })

  return NextResponse.json(subject)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'COORDENACAO', 'DIRETOR'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Soft-delete
  await prisma.subject.update({ where: { id: params.id }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
