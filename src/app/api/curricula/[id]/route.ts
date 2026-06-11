import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const curriculum = await prisma.curriculum.findUnique({
      where: { id: params.id },
      include: {
        saebDescriptors: {
          select: { saebDescriptorId: true }
        }
      }
    })
    if (!curriculum || !curriculum.active) {
      return NextResponse.json({ error: 'Currículo não encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      ...curriculum,
      saebDescriptorIds: curriculum.saebDescriptors.map(sd => sd.saebDescriptorId)
    })
  } catch (error: any) {
    console.error('[API Curricula ID] GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'COORDENACAO'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { name, description, saebDescriptorIds } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Nome do currículo é obrigatório' }, { status: 400 })

    const updated = await prisma.$transaction(async (tx) => {
      const curr = await tx.curriculum.update({
        where: { id: params.id },
        data: { name: name.trim(), description: description?.trim() }
      })

      if (Array.isArray(saebDescriptorIds)) {
        await tx.curriculumSaebDescriptor.deleteMany({ where: { curriculumId: params.id } })
        if (saebDescriptorIds.length > 0) {
          await tx.curriculumSaebDescriptor.createMany({
            data: saebDescriptorIds.map((sdId: string) => ({
              curriculumId: params.id,
              saebDescriptorId: sdId
            }))
          })
        }
      }

      return curr
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('[API Curricula ID] PUT error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'COORDENACAO'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await prisma.curriculum.update({
      where: { id: params.id },
      data: { active: false }
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API Curricula ID] DELETE error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
