import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const teacherId = searchParams.get('teacherId')

  let whereClause: any = { active: true }

  if (teacherId) {
    const teacherClasses = await prisma.teacherClass.findMany({
      where: { teacherId },
      select: { classId: true, subjectId: true }
    })
    const classIds = teacherClasses.map(tc => tc.classId)
    const subjectIds = teacherClasses.map(tc => tc.subjectId)

    whereClause = {
      active: true,
      OR: [
        { subjectId: { in: subjectIds } },
        { lessonClasses: { some: { classId: { in: classIds } } } }
      ]
    }
  }

  const lessons = await prisma.lesson.findMany({
    where: whereClause,
    include: {
      subject: true,
      lessonClasses: { include: { class: true } },
      materials: { orderBy: { order: 'asc' } },
      _count: { select: { classRecords: true, homework: true } }
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(lessons)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'COORDENACAO', 'PROFESSOR'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { classIds = [], materials = [], ...lessonData } = body

  const lesson = await prisma.lesson.create({
    data: {
      ...lessonData,
      startDate: lessonData.startDate ? new Date(lessonData.startDate) : undefined,
      endDate: lessonData.endDate ? new Date(lessonData.endDate) : undefined,
      createdById: (session.user as any).id,
      lessonClasses: { create: classIds.map((id: string) => ({ classId: id })) },
      materials: { create: materials },
    },
    include: { lessonClasses: true, materials: true },
  })

  await createAuditLog({
    userId: (session.user as any).id,
    action: 'CREATE',
    entityType: 'Lesson',
    entityId: lesson.id,
    newData: { title: lesson.title },
  })

  return NextResponse.json(lesson, { status: 201 })
}
