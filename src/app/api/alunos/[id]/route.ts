import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { getSchoolScope, schoolWhere } from '@/lib/user-context'

const ALL_ACCESS_ROLES = ['ADMIN', 'COORDENACAO', 'DIRETOR', 'PEDAGOGO', 'SECRETARIO']

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role as string
  const userId = (session.user as any).id as string

  const schoolIdScope = await getSchoolScope(session)
  if (schoolIdScope) {
    const studentExists = await prisma.student.findFirst({
      where: {
        id: params.id,
        ...schoolWhere.student(schoolIdScope),
      }
    })
    if (!studentExists) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Professor: verify the student is in one of their classes
  if (!ALL_ACCESS_ROLES.includes(role)) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      select: { teacherClasses: { select: { classId: true } } },
    })
    const allowedClassIds = teacher?.teacherClasses.map(tc => tc.classId) ?? []
    const stub = await prisma.student.findUnique({ where: { id: params.id }, select: { classId: true } })
    if (!stub || !stub.classId || !allowedClassIds.includes(stub.classId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const student = await prisma.student.findUnique({
    where: { id: params.id },
    include: {
      class: { include: { grade: { include: { segment: true } } } },
      guardians: true,
      gradeRecords: { include: { assessment: { include: { subject: true } } } },
      homeworkSubmissions: { include: { homework: { include: { subject: true } } } },
      pedagogicalRecords: { include: { pedagogue: true }, orderBy: { date: 'desc' } },
      academicHistory: { orderBy: { year: 'desc' } },
      attendances: { select: { date: true, status: true } },
    }
  })

  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Cross StudentAttendance dates with ClassRecord dates per subject
  const subjectAbsences: Record<string, { faltas: number; faltasJustificadas: number }> = {}

  if (student.classId) {
    const classRecords = await prisma.classRecord.findMany({
      where: { classId: student.classId, subjectId: { not: null } },
      select: { subjectId: true, date: true },
    })

    const faltaMap = new Map<string, string>()
    for (const a of student.attendances) {
      faltaMap.set(a.date.toISOString().slice(0, 10), a.status)
    }

    for (const cr of classRecords) {
      if (!cr.subjectId) continue
      const dateStr = cr.date.toISOString().slice(0, 10)
      const status = faltaMap.get(dateStr)
      if (!status || status === 'PRESENTE') continue
      if (!subjectAbsences[cr.subjectId]) subjectAbsences[cr.subjectId] = { faltas: 0, faltasJustificadas: 0 }
      if (status === 'FALTA') subjectAbsences[cr.subjectId].faltas++
      else subjectAbsences[cr.subjectId].faltasJustificadas++
    }
  }

  return NextResponse.json({ ...student, subjectAbsences })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'COORDENACAO'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const schoolIdScope = await getSchoolScope(session)
  if (schoolIdScope) {
    const studentExists = await prisma.student.findFirst({
      where: {
        id: params.id,
        ...schoolWhere.student(schoolIdScope),
      }
    })
    if (!studentExists) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await req.json()
  const { guardians, ...studentData } = body

  const previous = await prisma.student.findUnique({ where: { id: params.id } })
  const updated = await prisma.student.update({
    where: { id: params.id },
    data: {
      ...studentData,
      birthDate: studentData.birthDate ? new Date(studentData.birthDate) : undefined,
    }
  })

  await createAuditLog({
    userId: (session.user as any).id,
    action: 'UPDATE',
    entityType: 'Student',
    entityId: params.id,
    previousData: previous || undefined,
    newData: studentData,
  })

  return NextResponse.json(updated)
}
