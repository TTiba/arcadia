import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import bcrypt from 'bcryptjs'

const STAFF_ROLES = ['PROFESSOR', 'PEDAGOGO', 'SECRETARIO']

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const users = await prisma.user.findMany({
    where: { role: { in: STAFF_ROLES } },
    include: {
      teacher: {
        include: {
          teacherSubjects: { include: { subject: true } },
          teacherClasses: { include: { class: { include: { grade: true } }, subject: true } },
          _count: { select: { classRecords: true } },
        },
      },
      userClasses: {
        include: { class: { include: { grade: true } } },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'COORDENACAO', 'DIRETOR'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, email, password, staffRole, registration, subjectIds, classSubjects, classIds } = body

  if (!name || !email || !password || !staffRole) {
    return NextResponse.json({ error: 'Campos obrigatórios: nome, email, senha, tipo' }, { status: 400 })
  }
  if (!STAFF_ROLES.includes(staffRole)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: staffRole,
      // For PROFESSOR: create Teacher profile with subjects and classes
      ...(staffRole === 'PROFESSOR' ? {
        teacher: {
          create: {
            registration: registration || undefined,
            teacherSubjects: subjectIds?.length ? {
              create: subjectIds.map((sid: string) => ({ subjectId: sid })),
            } : undefined,
            teacherClasses: classSubjects?.length ? {
              create: classSubjects.map((cs: { classId: string; subjectId: string }) => ({
                classId: cs.classId,
                subjectId: cs.subjectId,
              })),
            } : undefined,
          },
        },
      } : {}),
      // For PEDAGOGO/SECRETARIO: link to classes directly
      ...(['PEDAGOGO', 'SECRETARIO'].includes(staffRole) && classIds?.length ? {
        userClasses: {
          create: classIds.map((cid: string) => ({ classId: cid })),
        },
      } : {}),
    },
  })

  await createAuditLog({
    userId: (session.user as any).id,
    action: 'CREATE',
    entityType: 'StaffMember',
    entityId: user.id,
    newData: { name: user.name, email: user.email, role: user.role },
  })

  return NextResponse.json({ ...user, password: undefined }, { status: 201 })
}
