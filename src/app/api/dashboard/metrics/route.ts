import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [
    totalStudents, totalClasses, totalLessons, totalTeachers,
    studentsWithoutHomework, teachersWithoutRecord, pendingPedagogical,
    recentClassRecords, lowPerformanceAssessments
  ] = await Promise.all([
    prisma.student.count({ where: { status: 'ATIVO' } }),
    prisma.class.count({ where: { active: true } }),
    prisma.lesson.count({ where: { active: true } }),
    prisma.teacher.count(),
    prisma.student.count({ where: { status: 'ATIVO', homeworkSubmissions: { none: {} } } }),
    prisma.teacher.count({ where: { classRecords: { none: {} } } }),
    prisma.pedagogicalRecord.count({ where: { resolved: false } }),
    prisma.classRecord.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { teacher: { include: { user: true } }, class: true, subject: true }
    }),
    // Assessments with average below 6
    prisma.assessment.findMany({
      include: { gradeRecords: true, subject: true, class: true },
      where: { active: true }
    }),
  ])

  const lowPerformance = lowPerformanceAssessments
    .map(a => ({
      ...a,
      average: a.gradeRecords.length
        ? a.gradeRecords.reduce((sum, r) => sum + (r.score || 0), 0) / a.gradeRecords.length
        : null
    }))
    .filter(a => a.average !== null && a.average < 6)

  return NextResponse.json({
    totals: { students: totalStudents, classes: totalClasses, lessons: totalLessons, teachers: totalTeachers },
    alerts: { studentsWithoutHomework, teachersWithoutRecord, pendingPedagogical },
    recentClassRecords,
    lowPerformanceAssessments: lowPerformance,
  })
}
