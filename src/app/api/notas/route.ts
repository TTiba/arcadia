import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSchoolScope, schoolWhere } from '@/lib/user-context'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const assessmentId = searchParams.get('assessmentId')
  if (!assessmentId) return NextResponse.json({ error: 'assessmentId required' }, { status: 400 })

  const schoolId = await getSchoolScope(session)
  if (schoolId) {
    const assessmentExists = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        ...schoolWhere.assessment(schoolId),
      }
    })
    if (!assessmentExists) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const records = await prisma.gradeRecord.findMany({
    where: { assessmentId },
    include: { student: true, teacher: { include: { user: true } } },
    orderBy: { student: { name: 'asc' } },
  })

  return NextResponse.json(records)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'PROFESSOR', 'COORDENACAO'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { grades = [] } = body

  const teacher = await prisma.teacher.findFirst({
    where: { userId: (session.user as any).id }
  })

  if (!teacher && role === 'PROFESSOR') return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })

  const results = await Promise.all(
    grades.map(async (g: { assessmentId: string; studentId: string; score: number; observations?: string }) => {
      return prisma.gradeRecord.upsert({
        where: { assessmentId_studentId: { assessmentId: g.assessmentId, studentId: g.studentId } },
        update: { score: g.score, observations: g.observations, userId: (session.user as any).id, teacherId: teacher?.id || '' },
        create: {
          assessmentId: g.assessmentId,
          studentId: g.studentId,
          score: g.score,
          observations: g.observations,
          userId: (session.user as any).id,
          teacherId: teacher?.id || '',
        },
      })
    })
  )

  return NextResponse.json(results)
}
