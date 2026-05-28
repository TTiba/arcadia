import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const classId = searchParams.get('classId')
  const subjectId = searchParams.get('subjectId')
  const teacherId = searchParams.get('teacherId')

  const records = await prisma.classRecord.findMany({
    where: {
      ...(classId ? { classId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(teacherId ? { teacherId } : {}),
    },
    include: {
      lesson: true,
      class: true,
      teacher: { include: { user: true } },
      subject: true,
    },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(records)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'PROFESSOR'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { lessonId, classId, teacherId, subjectId, date, contentDeveloped, observations, pending, adaptations } = body

  const record = await prisma.classRecord.create({
    data: {
      lessonId, classId, teacherId, subjectId,
      userId: (session.user as any).id,
      date: new Date(date),
      contentDeveloped, observations, pending, adaptations,
    },
    include: {
      lesson: true, class: true,
      teacher: { include: { user: true } }, subject: true,
    }
  })

  return NextResponse.json(record, { status: 201 })
}
