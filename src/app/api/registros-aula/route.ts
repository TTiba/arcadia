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
  const lessonId = searchParams.get('lessonId')

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const userEmail = session.user?.email || ''

  let andClause: any[] = []

  if (role !== 'ADMIN' && role !== 'DIRETOR') {
    if (userEmail.includes('eeteixeira')) {
      andClause.push({ class: { school: { name: { contains: 'Anísio Teixeira' } } } })
    } else if (userEmail.includes('eemlobato')) {
      andClause.push({ class: { school: { name: { contains: 'Monteiro Lobato' } } } })
    }
  }

  if (role === 'PROFESSOR') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      include: { teacherClasses: true }
    })

    if (teacher) {
      const classIds = teacher.teacherClasses.map(tc => tc.classId)
      const subjectIds = teacher.teacherClasses.map(tc => tc.subjectId)

      andClause.push({
        OR: [
          {
            classId: { in: classIds },
            subjectId: { in: subjectIds }
          },
          {
            lesson: {
              OR: [
                { subjectId: { in: subjectIds } },
                { subjects: { some: { id: { in: subjectIds } } } },
                {
                  AND: [
                    { subjectId: null },
                    { subjects: { none: {} } }
                  ]
                }
              ],
              lessonClasses: { some: { classId: { in: classIds } } }
            }
          }
        ]
      })
    } else {
      return NextResponse.json([])
    }
  }

  if (teacherId) {
    andClause.push({ teacherId })
  }
  if (classId) {
    andClause.push({ classId })
  }
  if (subjectId) {
    andClause.push({ subjectId })
  }
  if (lessonId) {
    andClause.push({ lessonId })
  }

  const records = await prisma.classRecord.findMany({
    where: andClause.length > 0 ? { AND: andClause } : {},
    include: {
      lesson: { include: { subjects: true } },
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
  const { id, lessonId, classId, teacherId, subjectId, date, contentDeveloped, observations, pending, adaptations } = body

  if (id) {
    const record = await prisma.classRecord.update({
      where: { id },
      data: {
        lessonId, classId, teacherId, subjectId,
        date: new Date(date),
        contentDeveloped, observations, pending, adaptations,
      },
      include: {
        lesson: true, class: true,
        teacher: { include: { user: true } }, subject: true,
      }
    })
    return NextResponse.json(record)
  }

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
