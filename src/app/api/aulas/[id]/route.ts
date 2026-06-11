import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'COORDENACAO', 'PROFESSOR'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const { classIds = [], subjectIds = [], materials = [], ...lessonData } = body

    const subjectId = subjectIds.length === 1 ? subjectIds[0] : null

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Delete existing class and material relations
      await tx.lessonClass.deleteMany({ where: { lessonId: params.id } })
      await tx.lessonMaterial.deleteMany({ where: { lessonId: params.id } })
      
      // 2. Disconnect existing subjects
      await tx.lesson.update({
        where: { id: params.id },
        data: {
          subjects: { set: [] }
        }
      })

      // 3. Update lesson and create new relations
      return await tx.lesson.update({
        where: { id: params.id },
        data: {
          title: lessonData.title,
          description: lessonData.description,
          startDate: lessonData.startDate ? new Date(lessonData.startDate) : null,
          endDate: lessonData.endDate ? new Date(lessonData.endDate) : null,
          subjectId,
          lessonClasses: { create: classIds.map((id: string) => ({ classId: id })) },
          materials: { create: materials.map((m: any) => ({ type: m.type, title: m.title, url: m.url, description: m.description })) },
          subjects: {
            connect: subjectIds.map((id: string) => ({ id }))
          }
        },
        include: {
          lessonClasses: { include: { class: true } },
          materials: true,
          subjects: true
        }
      })
    })

    await createAuditLog({
      userId: (session.user as any).id,
      action: 'UPDATE',
      entityType: 'Lesson',
      entityId: params.id,
      newData: { title: updated.title },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('[API Lesson ID] PUT error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'COORDENACAO', 'PROFESSOR'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    await prisma.lesson.update({
      where: { id: params.id },
      data: { active: false }
    })

    await createAuditLog({
      userId: (session.user as any).id,
      action: 'DELETE',
      entityType: 'Lesson',
      entityId: params.id,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API Lesson ID] DELETE error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
