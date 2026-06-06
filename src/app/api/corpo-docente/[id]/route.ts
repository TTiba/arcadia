import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      teacher: {
        include: {
          teacherSubjects: { include: { subject: true } },
          teacherClasses: { include: { class: { include: { grade: true } }, subject: true } },
        },
      },
      userClasses: {
        include: { class: { include: { grade: true } } },
      },
    },
  })

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...user, password: undefined })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'COORDENACAO', 'DIRETOR'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, email, active, registration, subjectIds, classSubjects, classIds } = body

  const existing = await prisma.user.findUnique({
    where: { id: params.id },
    include: { teacher: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Update user basic info
  const updated = await prisma.user.update({
    where: { id: params.id },
    data: { name, email, active },
  })

  if (existing.role === 'PROFESSOR' && existing.teacher) {
    const teacherId = existing.teacher.id

    // Update registration
    if (registration !== undefined) {
      await prisma.teacher.update({ where: { id: teacherId }, data: { registration } })
    }

    // Replace subjects
    if (subjectIds !== undefined) {
      await prisma.teacherSubject.deleteMany({ where: { teacherId } })
      if (subjectIds.length) {
        await prisma.teacherSubject.createMany({
          data: subjectIds.map((sid: string) => ({ teacherId, subjectId: sid })),
        })
      }
    }

    // Replace class-subject assignments
    if (classSubjects !== undefined) {
      await prisma.teacherClass.deleteMany({ where: { teacherId } })
      if (classSubjects.length) {
        await prisma.teacherClass.createMany({
          data: classSubjects.map((cs: { classId: string; subjectId: string }) => ({
            teacherId, classId: cs.classId, subjectId: cs.subjectId,
          })),
        })
      }
    }
  } else if (['PEDAGOGO', 'SECRETARIO'].includes(existing.role)) {
    // Replace class assignments
    if (classIds !== undefined) {
      await prisma.userClass.deleteMany({ where: { userId: params.id } })
      if (classIds.length) {
        await prisma.userClass.createMany({
          data: classIds.map((cid: string) => ({ userId: params.id, classId: cid })),
        })
      }
    }
  }

  await createAuditLog({
    userId: (session.user as any).id,
    action: 'UPDATE',
    entityType: 'StaffMember',
    entityId: params.id,
    newData: { name, email, active },
  })

  return NextResponse.json({ ...updated, password: undefined })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'COORDENACAO', 'DIRETOR'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.user.update({
    where: { id: params.id },
    data: { active: false },
  })

  return NextResponse.json({ ok: true })
}
