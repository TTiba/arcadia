import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALL_ACCESS_ROLES = ['ADMIN', 'COORDENACAO', 'DIRETOR', 'PEDAGOGO', 'SECRETARIO']

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role as string
  const userId = (session.user as any).id as string

  // Professor: see only their own logs
  const where = ALL_ACCESS_ROLES.includes(role)
    ? { studentId: params.id }
    : { studentId: params.id, userId }

  const logs = await prisma.studentLog.findMany({
    where,
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(logs)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { category, content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Conteúdo obrigatório' }, { status: 400 })

  const log = await prisma.studentLog.create({
    data: {
      studentId: params.id,
      userId: (session.user as any).id,
      category: category || 'OBSERVACAO',
      content: content.trim(),
    },
    include: { user: { select: { id: true, name: true, role: true } } },
  })

  return NextResponse.json(log, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const logId = searchParams.get('logId')
  if (!logId) return NextResponse.json({ error: 'logId obrigatório' }, { status: 400 })

  const log = await prisma.studentLog.findUnique({ where: { id: logId } })
  if (!log || log.studentId !== params.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  if (log.userId !== userId && !['ADMIN', 'COORDENACAO'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.studentLog.delete({ where: { id: logId } })
  return NextResponse.json({ ok: true })
}
