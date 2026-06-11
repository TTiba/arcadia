import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

const ALL_ACCESS_ROLES = ['ADMIN', 'COORDENACAO', 'DIRETOR', 'PEDAGOGO', 'SECRETARIO']

// Returns allowed classIds for the requesting user, or null if unrestricted
async function getAllowedClassIds(role: string, userId: string): Promise<string[] | null> {
  if (ALL_ACCESS_ROLES.includes(role)) return null
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { teacherClasses: { select: { classId: true } } },
  })
  return teacher?.teacherClasses.map(tc => tc.classId) ?? []
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role as string
  const userId = (session.user as any).id as string
  const userEmail = session.user?.email || ''
  const allowedClassIds = await getAllowedClassIds(role, userId)

  const { searchParams } = new URL(req.url)
  const classId  = searchParams.get('classId')  || undefined
  const gradeId  = searchParams.get('gradeId')  || undefined
  const status   = searchParams.get('status')   || undefined
  const search   = searchParams.get('search')   || undefined
  const subjectId = searchParams.get('subjectId') || undefined
  const dateFrom  = searchParams.get('dateFrom')  || undefined
  const dateTo    = searchParams.get('dateTo')    || undefined

  let schoolWhere = {}
  if (role !== 'ADMIN' && role !== 'DIRETOR' && role !== 'PROFESSOR') {
    if (userEmail.includes('eeteixeira')) {
      schoolWhere = { class: { school: { name: { contains: 'Anísio Teixeira' } } } }
    } else if (userEmail.includes('eemlobato')) {
      schoolWhere = { class: { school: { name: { contains: 'Monteiro Lobato' } } } }
    }
  }

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
      ...(allowedClassIds !== null ? { classId: { in: allowedClassIds } } : {}),
      ...schoolWhere,
    },
    include: {
      class: {
        include: {
          grade: true,
          school: true,
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
  if (!['ADMIN', 'COORDENACAO', 'DIRETOR'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
