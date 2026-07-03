import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import bcrypt from 'bcryptjs'
import { getSchoolScope, schoolWhere } from '@/lib/user-context'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const schoolId = await getSchoolScope(session)

  const teachers = await prisma.teacher.findMany({
    where: schoolWhere.teacher(schoolId),
    include: {
      user: true,
      teacherSubjects: { include: { subject: true } },
      teacherClasses: { include: { class: true, subject: true } },
      _count: { select: { classRecords: true } },
    },
    orderBy: { user: { name: 'asc' } },
  })

  return NextResponse.json(teachers)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'COORDENACAO'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, email, password, registration, subjectIds = [], classSubjects = [] } = body

  const hashedPassword = await bcrypt.hash(password || 'prof123', 10)

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, role: 'PROFESSOR' }
  })

  const teacher = await prisma.teacher.create({
    data: {
      userId: user.id,
      registration,
      teacherSubjects: {
        create: subjectIds.map((id: string) => ({ subjectId: id }))
      },
    }
  })

  // Link to class-subject pairs
  for (const { classId, subjectId } of classSubjects) {
    await prisma.teacherClass.upsert({
      where: { teacherId_classId_subjectId: { teacherId: teacher.id, classId, subjectId } },
      create: { teacherId: teacher.id, classId, subjectId },
      update: {},
    })
  }

  await createAuditLog({
    userId: (session.user as any).id,
    action: 'CREATE',
    entityType: 'Teacher',
    entityId: teacher.id,
    newData: { name, email, registration },
  })

  return NextResponse.json({ teacher, user: { ...user, password: undefined } }, { status: 201 })
}
