import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const classId = searchParams.get('classId')

  const homework = await prisma.homework.findMany({
    where: {
      active: true,
      ...(classId ? { classId } : {}),
    },
    include: {
      lesson: true,
      class: true,
      subject: true,
      materials: true,
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(homework)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'COORDENACAO', 'PROFESSOR'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { materials = [], ...hwData } = body

  const homework = await prisma.homework.create({
    data: {
      ...hwData,
      dueDate: hwData.dueDate ? new Date(hwData.dueDate) : undefined,
      materials: { create: materials },
    },
    include: { materials: true, class: true, subject: true },
  })

  return NextResponse.json(homework, { status: 201 })
}
