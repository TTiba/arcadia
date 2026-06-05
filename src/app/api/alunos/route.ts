import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const classId  = searchParams.get('classId')  || undefined
  const gradeId  = searchParams.get('gradeId')  || undefined
  const status   = searchParams.get('status')   || undefined
  const search   = searchParams.get('search')   || undefined
  const subjectId = searchParams.get('subjectId') || undefined
  const dateFrom  = searchParams.get('dateFrom')  || undefined
  const dateTo    = searchParams.get('dateTo')    || undefined

  const hwWhere = {
    ...(subjectId ? { subjectId } : {}),
    ...(dateFrom || dateTo ? {
      dueDate: {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
      }
    } : {}),
  }

  const students = await prisma.student.findMany({
    where: {
      ...(classId ? { classId } : {}),
      ...(gradeId ? { class: { gradeId } } : {}),
      ...(status  ? { status } : {}),
      ...(search  ? { OR: [{ name: { contains: search } }, { enrollment: { contains: search } }] } : {}),
    },
    include: {
      class: {
        include: {
          grade: true,
          _count: { select: { homework: Object.keys(hwWhere).length ? { where: hwWhere } : true } },
        },
      },
      guardians: true,
      _count: {
        select: {
          homeworkSubmissions: Object.keys(hwWhere).length
            ? { where: { homework: hwWhere } }
            : true,
          gradeRecords: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(students)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'COORDENACAO'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { guardians, ...studentData } = body

  const student = await prisma.student.create({
    data: {
      ...studentData,
      birthDate: studentData.birthDate ? new Date(studentData.birthDate) : undefined,
      guardians: guardians?.length ? {
        create: guardians.map((g: any) => ({
          name: g.name, relationship: g.relationship,
          phone: g.phone, email: g.email, isPrimary: g.isPrimary || false,
        }))
      } : undefined,
    },
  })

  await createAuditLog({
    userId: (session.user as any).id,
    action: 'CREATE',
    entityType: 'Student',
    entityId: student.id,
    newData: { name: student.name, enrollment: student.enrollment },
  })

  return NextResponse.json(student, { status: 201 })
}
