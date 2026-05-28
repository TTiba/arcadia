import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const student = await prisma.student.findUnique({
    where: { id: params.id },
    include: {
      class: { include: { grade: { include: { segment: true } } } },
      guardians: true,
      gradeRecords: { include: { assessment: { include: { subject: true } } } },
      homeworkSubmissions: { include: { homework: { include: { subject: true } } } },
      pedagogicalRecords: { include: { pedagogue: true }, orderBy: { date: 'desc' } },
      academicHistory: { orderBy: { year: 'desc' } },
    }
  })

  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(student)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'COORDENACAO'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
