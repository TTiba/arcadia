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

  const assessments = await prisma.assessment.findMany({
    where: {
      active: true,
      ...(classId ? { classId } : {}),
      ...(subjectId ? { subjectId } : {}),
    },
    include: {
      subject: true,
      class: true,
      gradeRecords: {
        include: { student: true, teacher: { include: { user: true } } }
      },
    },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(assessments)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'COORDENACAO'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const assessment = await prisma.assessment.create({
    data: {
      ...body,
      date: body.date ? new Date(body.date) : undefined,
      weight: parseFloat(body.weight) || 1,
      maxScore: parseFloat(body.maxScore) || 10,
    }
  })

  return NextResponse.json(assessment, { status: 201 })
}
