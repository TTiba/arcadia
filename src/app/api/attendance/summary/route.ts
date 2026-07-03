import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSchoolScope } from '@/lib/user-context'

// GET /api/attendance/summary?classId=X&days=30
// Returns per-student absence counts and overall class stats
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const classId = searchParams.get('classId')
  const days = parseInt(searchParams.get('days') || '30')

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

  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)

  const [students, records] = await Promise.all([
    prisma.student.findMany({
      where: { classId, status: 'ATIVO' },
      select: { id: true, name: true, enrollment: true },
      orderBy: { name: 'asc' },
    }),
    prisma.studentAttendance.findMany({
      where: { classId, date: { gte: since } },
      select: { studentId: true, date: true, status: true },
    }),
  ])

  // Count unique school days with records
  const schoolDaysRecorded = new Set(records.map(r => r.date.toISOString().slice(0, 10))).size

  const countMap = new Map<string, { faltas: number; justificadas: number }>()
  for (const r of records) {
    const cur = countMap.get(r.studentId) ?? { faltas: 0, justificadas: 0 }
    if (r.status === 'FALTA') cur.faltas++
    else if (r.status === 'FALTA_JUSTIFICADA') cur.justificadas++
    countMap.set(r.studentId, cur)
  }

  const result = students.map(s => {
    const counts = countMap.get(s.id) ?? { faltas: 0, justificadas: 0 }
    return {
      ...s,
      faltas: counts.faltas,
      faltasJustificadas: counts.justificadas,
      total: counts.faltas + counts.justificadas,
      frequencia: schoolDaysRecorded > 0
        ? Math.round(((schoolDaysRecorded - counts.faltas - counts.justificadas) / schoolDaysRecorded) * 100)
        : 100,
    }
  }).sort((a, b) => b.faltas - a.faltas)

  const atRiskCount = result.filter(s => s.total >= 5).length
  const avgFaltas = result.length > 0
    ? (result.reduce((sum, s) => sum + s.faltas, 0) / result.length).toFixed(1)
    : '0.0'

  return NextResponse.json({
    students: result,
    schoolDaysRecorded,
    atRiskCount,
    avgFaltas,
    totalStudents: students.length,
  })
}
