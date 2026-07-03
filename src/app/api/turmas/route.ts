import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { getSchoolScope, schoolWhere } from '@/lib/user-context'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role

  const schoolId = await getSchoolScope(session)

  let teacherWhere = {}
  if (role === 'PROFESSOR') {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: (session.user as any).id },
      select: { teacherClasses: { select: { classId: true } } }
    })
    const classIds = teacher?.teacherClasses.map(tc => tc.classId) ?? []
    teacherWhere = { id: { in: classIds } }
  }

  const classes = await prisma.class.findMany({
    where: {
      active: true,
      ...(role === 'PROFESSOR' ? {} : schoolWhere.class(schoolId)),
      ...teacherWhere,
    },
    include: {
      grade: { include: { segment: true } },
      school: true,
      curriculum: true,
      teacherClasses: {
        include: { teacher: { include: { user: true } }, subject: true }
      },
      _count: { select: { students: true } }
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(classes)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'COORDENACAO'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, curriculumId, gradeId, period, schoolId, shift, year } = body

  const created = await prisma.class.create({
    data: { name, curriculumId, gradeId, period, schoolId, shift, year: year || new Date().getFullYear() },
  })

  await createAuditLog({
    userId: (session.user as any).id,
    action: 'CREATE',
    entityType: 'Class',
    entityId: created.id,
    newData: body,
  })

  return NextResponse.json(created, { status: 201 })
}
