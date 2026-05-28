import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'COORDENACAO'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const previous = await prisma.class.findUnique({ where: { id: params.id } })
  const updated = await prisma.class.update({ where: { id: params.id }, data: body })

  await createAuditLog({
    userId: (session.user as any).id,
    action: 'UPDATE',
    entityType: 'Class',
    entityId: params.id,
    previousData: previous || undefined,
    newData: body,
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.class.update({ where: { id: params.id }, data: { active: false } })

  await createAuditLog({
    userId: (session.user as any).id,
    action: 'DELETE',
    entityType: 'Class',
    entityId: params.id,
  })

  return NextResponse.json({ success: true })
}
