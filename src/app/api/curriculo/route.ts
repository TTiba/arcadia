import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT: set the full subject list for a grade (replaces existing)
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'COORDENACAO', 'DIRETOR'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { curriculumId, gradeId, subjectIds } = await req.json()
  if (!curriculumId || !gradeId) return NextResponse.json({ error: 'curriculumId e gradeId obrigatórios' }, { status: 400 })

  // Delete and recreate
  await prisma.gradeSubject.deleteMany({ where: { curriculumId, gradeId } })
  if (subjectIds?.length) {
    await prisma.gradeSubject.createMany({
      data: (subjectIds as string[]).map((subjectId, i) => ({
        curriculumId, gradeId, subjectId, order: i,
      })),
    })
  }

  return NextResponse.json({ ok: true })
}

// POST: add a single subject to a grade
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'COORDENACAO', 'DIRETOR'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { curriculumId, gradeId, subjectId, weeklyHours } = await req.json()
  if (!curriculumId || !gradeId || !subjectId) return NextResponse.json({ error: 'curriculumId, gradeId e subjectId obrigatórios' }, { status: 400 })

  const gs = await prisma.gradeSubject.upsert({
    where: { curriculumId_gradeId_subjectId: { curriculumId, gradeId, subjectId } },
    update: { weeklyHours: weeklyHours ?? 0 },
    create: { curriculumId, gradeId, subjectId, weeklyHours: weeklyHours ?? 0 },
  })

  return NextResponse.json(gs, { status: 201 })
}

// DELETE: remove a subject from a grade
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'COORDENACAO', 'DIRETOR'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const curriculumId = searchParams.get('curriculumId')
  const gradeId = searchParams.get('gradeId')
  const subjectId = searchParams.get('subjectId')
  if (!curriculumId || !gradeId || !subjectId) return NextResponse.json({ error: 'Parâmetros ausentes' }, { status: 400 })

  await prisma.gradeSubject.delete({ where: { curriculumId_gradeId_subjectId: { curriculumId, gradeId, subjectId } } })
  return NextResponse.json({ ok: true })
}
