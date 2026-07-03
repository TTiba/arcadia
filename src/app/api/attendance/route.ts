import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSchoolScope } from '@/lib/user-context'

// GET /api/attendance?classId=X&date=YYYY-MM-DD
// Returns all students in the class with their attendance status for that date
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const classId = searchParams.get('classId')
  const dateStr = searchParams.get('date')

  if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 })

  const schoolId = await getSchoolScope(session)
  if (schoolId) {
    const classExists = await prisma.class.findFirst({
      where: { id: classId, schoolId },
    })
    if (!classExists) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const date = dateStr ? new Date(dateStr) : new Date()
  date.setHours(0, 0, 0, 0)
  const nextDay = new Date(date)
  nextDay.setDate(nextDay.getDate() + 1)

  const [students, records] = await Promise.all([
    prisma.student.findMany({
      where: { classId, status: 'ATIVO' },
      select: { id: true, name: true, enrollment: true },
      orderBy: { name: 'asc' },
    }),
    prisma.studentAttendance.findMany({
      where: {
        classId,
        date: { gte: date, lt: nextDay },
      },
      select: { id: true, studentId: true, status: true, justification: true, justifiedBy: true },
    }),
  ])

  const recordMap = new Map(records.map(r => [r.studentId, r]))

  const result = students.map(s => ({
    ...s,
    attendanceId: recordMap.get(s.id)?.id ?? null,
    status: recordMap.get(s.id)?.status ?? 'PRESENTE',
    justification: recordMap.get(s.id)?.justification ?? null,
    justifiedBy: recordMap.get(s.id)?.justifiedBy ?? null,
  }))

  return NextResponse.json({ students: result, date: date.toISOString(), recorded: records.length > 0 })
}

// POST /api/attendance
// Body: { classId, date, absences: [studentId, ...] }
// Creates StudentAttendance records for all students in the class; removes any stale records for others
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (!['PROFESSOR', 'ADMIN', 'COORDENACAO', 'PEDAGOGO'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { classId, date: dateStr, absences = [] } = body

  if (!classId || !dateStr) return NextResponse.json({ error: 'classId and date required' }, { status: 400 })

  const schoolId = await getSchoolScope(session)
  if (schoolId) {
    const classExists = await prisma.class.findFirst({
      where: { id: classId, schoolId },
    })
    if (!classExists) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const date = new Date(dateStr)
  date.setHours(0, 0, 0, 0)
  const nextDay = new Date(date)
  nextDay.setDate(nextDay.getDate() + 1)

  const userId = (session.user as any).id

  // Fetch all active students in this class
  const students = await prisma.student.findMany({
    where: { classId, status: 'ATIVO' },
    select: { id: true }
  })

  // Delete existing records for this class on this date, then re-create
  await prisma.studentAttendance.deleteMany({
    where: { classId, date: { gte: date, lt: nextDay } },
  })

  if (students.length > 0) {
    const absenceSet = new Set(absences)
    await prisma.studentAttendance.createMany({
      data: students.map((s) => ({
        studentId: s.id,
        classId,
        date,
        status: absenceSet.has(s.id) ? 'FALTA' : 'PRESENTE',
        recordedBy: userId,
      })),
    })
  }

  return NextResponse.json({ ok: true, absences: absences.length })
}
