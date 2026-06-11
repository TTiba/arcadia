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
  const classId = searchParams.get('classId')

  let andClause: any[] = [{ active: true }]

  const role = (session.user as any).role
  const userEmail = session.user?.email || ''

  if (role !== 'ADMIN' && role !== 'DIRETOR') {
    if (userEmail.includes('eeteixeira')) {
      andClause.push({
        lessonClasses: { some: { class: { school: { name: { contains: 'Anísio Teixeira' } } } } }
      })
    } else if (userEmail.includes('eemlobato')) {
      andClause.push({
        lessonClasses: { some: { class: { school: { name: { contains: 'Monteiro Lobato' } } } } }
      })
    }
  }

  if (teacherId) {
    const teacherClasses = await prisma.teacherClass.findMany({
      where: { teacherId },
      select: { classId: true, subjectId: true }
    })
    const classIds = teacherClasses.map(tc => tc.classId)
    const subjectIds = teacherClasses.map(tc => tc.subjectId)

    andClause.push({
      OR: [
        { subjectId: { in: subjectIds } },
        { subjects: { some: { id: { in: subjectIds } } } },
        {
          AND: [
            { subjectId: null },
            { subjects: { none: {} } },
            { lessonClasses: { some: { classId: { in: classIds } } } }
          ]
        }
      ]
    })
  }

  if (classId) {
    andClause.push({
      lessonClasses: { some: { classId } }
    })
  }

  const lessons = await prisma.lesson.findMany({
    where: { AND: andClause },
    include: {
      subject: true,
      subjects: true,
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
  const { classIds = [], subjectIds = [], materials = [], ...lessonData } = body

  // Set subjectId to the first subject for backward compatibility
  const subjectId = subjectIds.length === 1 ? subjectIds[0] : null

  const lesson = await prisma.lesson.create({
    data: {
      ...lessonData,
      subjectId,
      startDate: lessonData.startDate ? new Date(lessonData.startDate) : undefined,
      endDate: lessonData.endDate ? new Date(lessonData.endDate) : undefined,
      createdById: (session.user as any).id,
      lessonClasses: { create: classIds.map((id: string) => ({ classId: id })) },
      materials: { create: materials },
      subjects: {
        connect: subjectIds.map((id: string) => ({ id }))
      }
    },
    include: {
      lessonClasses: { include: { class: true } },
      materials: true,
      subjects: true,
    },
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
